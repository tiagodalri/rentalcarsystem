import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

const ACCOUNTS = [
  { role: "admin",      email: "admin@zeustest.com",      password: "Teste1234" },
  { role: "finance",    email: "finance@zeustest.com",    password: "Teste1234" },
  { role: "operations", email: "operations@zeustest.com", password: "Teste1234" },
  { role: "support",    email: "support@zeustest.com",    password: "Teste1234" },
];

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/bin/chromium" });
  try {
    for (const acc of ACCOUNTS) {
      const ctx = await browser.newContext({ baseURL: BASE_URL });
      const page = await ctx.newPage();
      await page.goto("/admin/login");
      await page.fill('input[type="email"]', acc.email);
      await page.fill('input[type="password"]', acc.password);
      await Promise.all([
        page.waitForURL("**/admin", { timeout: 15_000 }),
        page.click('button[type="submit"]'),
      ]);
      // Sanity: sidebar logo / dashboard mounted
      await page.waitForSelector('img[alt="Sua Marca"]', { timeout: 10_000 });

      const storagePath = `e2e/.auth/${acc.role}.json`;
      mkdirSync(dirname(storagePath), { recursive: true });
      await ctx.storageState({ path: storagePath });
      await ctx.close();
      // eslint-disable-next-line no-console
      console.log(`[globalSetup] storageState saved for ${acc.role}`);
    }
  } finally {
    await browser.close();
  }
}
