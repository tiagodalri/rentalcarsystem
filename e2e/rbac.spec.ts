import { test, expect, type Page } from "@playwright/test";

type Role = "admin" | "finance" | "operations" | "support";

const SIDEBAR_BY_ROLE: Record<Role, string[]> = {
  admin:      ["Dashboard","Live","Reservas","Frota","Clientes","Financeiro","Equipe","Relatório","Lucro Frota","Configurações"],
  finance:    ["Dashboard","Financeiro","Relatório","Lucro Frota"],
  operations: ["Dashboard","Live","Reservas","Frota","Clientes","Lucro Frota"],
  support:    ["Dashboard","Reservas","Clientes"],
};

const ALL_ITEMS = ["Dashboard","Live","Reservas","Frota","Clientes","Financeiro","Equipe","Relatório","Lucro Frota","Configurações"];

// One blocked URL per non-admin role per spec
const BLOCKED_URL_BY_ROLE: Record<Exclude<Role, "admin">, string> = {
  finance:    "/admin/team",
  operations: "/admin/finance",
  support:    "/admin/fleet",
};

async function gotoAdmin(page: Page) {
  await page.goto("/admin");
  await page.waitForSelector('img[alt="Zeus"]', { timeout: 10_000 });
}

function runForRole(role: Role) {
  test.describe(`[${role}]`, () => {
    test("sidebar shows exactly the expected items", async ({ page }) => {
      await gotoAdmin(page);
      const expected = SIDEBAR_BY_ROLE[role];
      const sidebar = page.locator('[data-sidebar="sidebar"], aside').first();

      for (const item of expected) {
        await expect(sidebar.getByRole("button", { name: item, exact: true })).toBeVisible();
      }
      const forbidden = ALL_ITEMS.filter((i) => !expected.includes(i));
      for (const item of forbidden) {
        await expect(sidebar.getByRole("button", { name: item, exact: true })).toHaveCount(0);
      }
    });

    if (role !== "admin") {
      test(`direct URL to ${BLOCKED_URL_BY_ROLE[role]} is blocked`, async ({ page }) => {
        await page.goto(BLOCKED_URL_BY_ROLE[role]);
        // RequireRole should redirect away from the protected page (back to /admin or similar)
        await page.waitForLoadState("networkidle");
        // The page must not actually render the blocked route's primary heading,
        // and the URL should no longer point to the forbidden path (or should show a fallback).
        const url = new URL(page.url());
        expect(url.pathname).not.toBe(BLOCKED_URL_BY_ROLE[role]);
      });
    }

    test("logout returns user to /admin/login", async ({ page }) => {
      await gotoAdmin(page);
      const sidebar = page.locator('[data-sidebar="sidebar"], aside').first();
      await sidebar.getByRole("button", { name: "Sair", exact: true }).click();
      await page.waitForURL("**/admin/login", { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe("/admin/login");
    });
  });
}

// Each project has its own storageState; only run the matching role's tests per project.
const projectRole = (test.info as unknown) as never; // placeholder to satisfy TS
void projectRole;

test.describe("RBAC E2E", () => {
  // Use project name to drive which role's expectations apply.
  test.beforeEach(async ({}, testInfo) => {
    const allowed = ["admin", "finance", "operations", "support"];
    if (!allowed.includes(testInfo.project.name)) test.skip();
  });

  for (const role of ["admin", "finance", "operations", "support"] as Role[]) {
    test.describe(role, () => {
      test.skip(({}, testInfo) => testInfo.project.name !== role, `only runs in project ${role}`);
      runForRole(role);
    });
  }
});
