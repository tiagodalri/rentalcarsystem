import { test, expect, type Page } from "@playwright/test";

type Role = "admin" | "finance" | "operations" | "support";

const SIDEBAR_BY_ROLE: Record<Role, string[]> = {
  admin:      ["Dashboard","Live","Reservas","Frota","Clientes","Financeiro","Equipe","Relatório","Lucro Frota","Configurações"],
  finance:    ["Dashboard","Financeiro","Relatório","Lucro Frota"],
  operations: ["Dashboard","Live","Reservas","Frota","Clientes","Lucro Frota"],
  support:    ["Dashboard","Reservas","Clientes"],
};

const ALL_ITEMS = ["Dashboard","Live","Reservas","Frota","Clientes","Financeiro","Equipe","Relatório","Lucro Frota","Configurações"];

const BLOCKED_URL_BY_ROLE: Record<Exclude<Role, "admin">, string> = {
  finance:    "/admin/team",
  operations: "/admin/finance",
  support:    "/admin/fleet",
};

async function gotoAdmin(page: Page) {
  await page.goto("/admin");
  await page.waitForSelector('img[alt="Sua Marca"]', { timeout: 10_000 });
}

test.describe("RBAC", () => {
  test("sidebar shows exactly the expected items for this role", async ({ page }, testInfo) => {
    const role = testInfo.project.name as Role;
    await gotoAdmin(page);
    const expected = SIDEBAR_BY_ROLE[role];
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();

    for (const item of expected) {
      await expect(sidebar.getByRole("button", { name: item, exact: true })).toBeVisible();
    }
    const forbidden = ALL_ITEMS.filter((i) => !expected.includes(i));
    for (const item of forbidden) {
      await expect(sidebar.getByRole("button", { name: item, exact: true })).toHaveCount(0);
    }
  });

  test("direct URL to a forbidden admin route is blocked", async ({ page }, testInfo) => {
    const role = testInfo.project.name as Role;
    if (role === "admin") test.skip();
    const blocked = BLOCKED_URL_BY_ROLE[role as Exclude<Role, "admin">];
    await page.goto(blocked);
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe(blocked);
  });

  test("logout returns to /admin/login", async ({ page }) => {
    await gotoAdmin(page);
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await sidebar.getByRole("button", { name: "Sair", exact: true }).click();
    await page.waitForURL("**/admin/login", { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/admin/login");
  });
});
