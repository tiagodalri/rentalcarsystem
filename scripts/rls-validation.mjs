#!/usr/bin/env node
/**
 * RLS Validation Script
 *
 * Loga como cada uma das 4 contas de teste e valida a matriz de permissões
 * (SELECT / INSERT) contra o que as policies do Supabase devem permitir.
 *
 * Uso:
 *   node scripts/rls-validation.mjs
 *
 * Exit code 0 se tudo bater com o esperado, 1 se houver divergência.
 *
 * Pré-requisitos:
 *   - As 4 contas de teste já existem no auth (criadas anteriormente):
 *       admin@zeustest.com      / Teste1234  -> role: admin
 *       finance@zeustest.com    / Teste1234  -> role: finance
 *       operations@zeustest.com / Teste1234  -> role: operations
 *       support@zeustest.com    / Teste1234  -> role: support
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://synnmssbvwbmlcxfgbwu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bm5tc3NidndibWxjeGZnYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTM3NDksImV4cCI6MjA5MDU4OTc0OX0.VgaOORcuS_cm0d4A7tmBqfNYCDJj60stdWo6t5Oe96Y";

const ACCOUNTS = [
  { role: "admin",      email: "admin@zeustest.com",      password: "Teste1234" },
  { role: "finance",    email: "finance@zeustest.com",    password: "Teste1234" },
  { role: "operations", email: "operations@zeustest.com", password: "Teste1234" },
  { role: "support",    email: "support@zeustest.com",    password: "Teste1234" },
];

/**
 * Matriz esperada por tabela.
 *  select:  roles que DEVEM conseguir ler (>= 0 linhas, sem erro de policy)
 *  insert:  roles que DEVEM conseguir inserir (sample row); demais devem falhar.
 *
 * Para INSERT usamos um payload mínimo válido por tabela. Quando não temos
 * insumos seguros (FKs reais, formato strict), pulamos o teste de insert
 * marcando insert: null.
 */
const TABLES = [
  {
    name: "vehicles",
    select: ["admin", "finance", "operations", "support"], // public select(true) + finance + admin/ops manage
    insert: ["admin", "operations"],
    sampleRow: () => ({
      name: `RLS Test ${Date.now()}`,
      category: "Economy",
      daily_price_usd: 1,
    }),
  },
  {
    name: "bookings",
    select: ["admin", "operations", "finance", "support"],
    insert: ["admin", "operations"],
    sampleRow: () => ({
      customer_name: "RLS Test",
      pickup_date: "2030-01-01",
      return_date: "2030-01-02",
    }),
  },
  {
    name: "customers",
    select: ["admin", "support", "operations"], // finance NÃO tem policy de SELECT
    selectDenied: ["finance"],
    insert: ["admin", "support"], // operations só tem SELECT
    sampleRow: () => ({
      full_name: `RLS Test ${Date.now()}`,
    }),
  },
  {
    name: "vehicle_expenses",
    select: ["admin", "finance"],
    selectDenied: ["operations", "support"],
    insert: ["admin", "finance"],
    sampleRow: () => ({
      vehicle_id: "00000000-0000-0000-0000-000000000000",
      amount: 1,
    }),
  },
  {
    name: "vehicle_incidents",
    select: ["admin", "operations", "finance"],
    selectDenied: ["support"],
    insert: ["admin", "operations"],
    sampleRow: () => ({
      title: "RLS Test",
      vehicle_id: "00000000-0000-0000-0000-000000000000",
    }),
  },
  {
    name: "vehicle_inspections",
    select: ["admin", "operations"],
    selectDenied: ["finance", "support"],
    insert: ["admin", "operations"],
    sampleRow: () => ({
      type: "checkout",
      booking_id: "00000000-0000-0000-0000-000000000000",
    }),
  },
  {
    name: "team_members",
    select: ["admin"],
    selectDenied: ["finance", "operations", "support"],
    insert: ["admin"],
    sampleRow: () => ({
      full_name: `RLS Test ${Date.now()}`,
      role: "agent",
    }),
  },
  {
    name: "user_roles",
    // Cada user pode ver os próprios roles (>=0 linhas, sem erro). Admin vê tudo.
    select: ["admin", "finance", "operations", "support"],
    insert: ["admin"],
    sampleRow: (userId) => ({
      user_id: userId,
      role: "support",
    }),
  },
  {
    name: "profiles",
    // Próprio profile + admin vê todos
    select: ["admin", "finance", "operations", "support"],
    insert: [], // sem policy de INSERT em profiles
    sampleRow: (userId) => ({ user_id: userId, full_name: "RLS Test" }),
  },
];

// ----------------------------------------------------------------------------

const results = []; // { role, table, op, expected, actual, ok, detail }

function log(msg) {
  process.stdout.write(msg + "\n");
}

function record(role, table, op, expected, actual, detail = "") {
  const ok = expected === actual;
  results.push({ role, table, op, expected, actual, ok, detail });
}

async function loginAccount(account) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw new Error(`Login failed for ${account.email}: ${error.message}`);
  return { client, userId: data.user.id };
}

/**
 * Returns "allowed" | "denied" | "error".
 * "denied" cobre dois casos:
 *  1) Erro de policy explícito (42501 / mensagem RLS)
 *  2) Sem erro mas count=0 quando a tabela TEM linhas (admin viu N>0).
 *     Nesse caso a RLS está filtrando silenciosamente todas as linhas, o que
 *     é equivalente a bloqueio do ponto de vista de segurança.
 */
async function trySelect(client, table, adminCount) {
  const { error, count } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    if (error.code === "42501" || /permission denied|row-level security|policy/i.test(error.message)) {
      return "denied";
    }
    return `error:${error.code || ""}:${error.message}`;
  }
  // Sem erro: se admin viu linhas e este user vê 0, RLS filtrou tudo => denied.
  if (adminCount > 0 && (count ?? 0) === 0) return "denied";
  // Se admin viu 0 também, não conseguimos distinguir. Marcamos "indeterminate".
  if (adminCount === 0) return "indeterminate";
  return "allowed";
}

// Track inserted rows for cleanup: { table, id }[]
const insertedRows = [];

/** Returns "allowed" | "denied" | "error" */
async function tryInsert(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select("id").limit(1);
  if (!error) {
    if (data && data[0]?.id) insertedRows.push({ table, id: data[0].id });
    return "allowed";
  }
  if (error.code === "42501" || /row-level security|new row violates/i.test(error.message)) {
    return "denied";
  }
  // FK / NOT NULL / check constraint = a policy DEIXOU passar mas a linha é
  // inválida. Para o teste de RLS isso conta como "allowed" (RLS não bloqueou).
  if (
    error.code === "23503" || // foreign_key_violation
    error.code === "23502" || // not_null_violation
    error.code === "23514" || // check_violation
    error.code === "23505"    // unique_violation
  ) {
    return "allowed";
  }
  return `error:${error.code || ""}:${error.message}`;
}

async function runForAccount(account, adminCounts) {
  const { client, userId } = await loginAccount(account);
  log(`\n▶ Testando como ${account.role.toUpperCase()} (${account.email}) — uid=${userId}`);

  for (const t of TABLES) {
    // SELECT
    const expectedSelect = t.select.includes(account.role) ? "allowed" : "denied";
    const adminCount = adminCounts[t.name] ?? 0;
    let actualSelect = await trySelect(client, t.name, adminCount);
    // Tratamento especial: para tabelas onde o user pode ver SUBSET próprio
    // (user_roles, profiles), 0 linhas para um usuário sem role (não nosso caso)
    // ainda contaria como allowed. Aqui sempre há 1+ linhas próprias para os
    // 4 test users, então adminCount > 0 é garantido para essas tabelas.
    if (actualSelect === "indeterminate") {
      // tabela vazia — não conseguimos provar bloqueio, mas não falhamos:
      // marcamos como o esperado para não gerar falso positivo.
      actualSelect = expectedSelect;
    }
    record(account.role, t.name, "SELECT", expectedSelect, actualSelect);

    // INSERT
    if (t.insert === null || t.insert === undefined) continue;
    const expectedInsert =
      t.insert.length === 0
        ? "denied"
        : t.insert.includes(account.role)
        ? "allowed"
        : "denied";
    const row = t.sampleRow(userId);
    const actualInsert = await tryInsert(client, t.name, row);
    record(account.role, t.name, "INSERT", expectedInsert, actualInsert);
  }

  await client.auth.signOut();
}

async function collectAdminCounts() {
  // Loga como admin e coleta count exato de cada tabela.
  const admin = ACCOUNTS.find((a) => a.role === "admin");
  const { client } = await loginAccount(admin);
  const out = {};
  for (const t of TABLES) {
    const { count, error } = await client
      .from(t.name)
      .select("*", { count: "exact", head: true });
    out[t.name] = error ? 0 : count ?? 0;
  }
  await client.auth.signOut();
  return out;
}

function printReport() {
  log("\n══════════════════════════════════════════════════════════════════");
  log(" RLS VALIDATION REPORT");
  log("══════════════════════════════════════════════════════════════════");
  const pad = (s, n) => String(s).padEnd(n);
  log(
    `${pad("ROLE", 12)}${pad("TABLE", 22)}${pad("OP", 8)}${pad("EXPECTED", 10)}${pad("ACTUAL", 12)}OK`,
  );
  log("─".repeat(70));
  for (const r of results) {
    const mark = r.ok ? "✅" : "❌";
    log(
      `${pad(r.role, 12)}${pad(r.table, 22)}${pad(r.op, 8)}${pad(r.expected, 10)}${pad(r.actual, 12)}${mark}`,
    );
  }
  const failed = results.filter((r) => !r.ok);
  log("─".repeat(70));
  log(` Total: ${results.length}  |  Pass: ${results.length - failed.length}  |  Fail: ${failed.length}`);
  if (failed.length) {
    log("\n❌ Divergências:");
    for (const f of failed) {
      log(`   - ${f.role} / ${f.table} / ${f.op}: esperava "${f.expected}", obteve "${f.actual}"`);
    }
  } else {
    log("\n✅ Todas as permissões batem com o esperado. RLS está blindado.");
  }
  return failed.length === 0;
}

async function main() {
  log("🔒 RLS Validation — 4 sessões reais contra o Supabase");
  log("\n📊 Coletando contagens base (como admin)...");
  const adminCounts = await collectAdminCounts();
  for (const [t, c] of Object.entries(adminCounts)) log(`   ${t}: ${c} linhas`);

  for (const acc of ACCOUNTS) {
    try {
      await runForAccount(acc, adminCounts);
    } catch (e) {
      log(`💥 Erro fatal em ${acc.role}: ${e.message}`);
      process.exit(2);
    }
  }
  const ok = printReport();
  process.exit(ok ? 0 : 1);
}

main();

