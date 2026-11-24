import { ADMIN, expect, expectNoHorizontalOverflow, test, uniqueTitle } from "./fixtures";

test.describe("portal institucional", () => {
  test("rechaza credenciales inválidas y entra con las correctas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Portal institucional" })).toBeVisible();

    await page.getByLabel("Correo institucional").fill(ADMIN.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toContainText("Correo o contraseña incorrectos.");

    await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Actividad de emisión" })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("heading", { name: "Portal institucional" })).toBeVisible();
  });

  test("devuelve al login cuando la API rechaza la sesión guardada", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "certichain-session",
        JSON.stringify({
          token: "token-invalido",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          user: { id: "x", email: "admin@certichain.local", role: "admin" },
        }),
      );
    });
    await page.goto("/");
    await expect(page.getByText("Tu sesión ya no es válida. Inicia sesión de nuevo.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portal institucional" })).toBeVisible();
  });

  test("el filtro de periodo cambia las cifras del dashboard", async ({ portal: page }) => {
    await page.goto("/");
    const issued = page.getByRole("region", { name: "Indicadores del periodo" }).locator(".figure").first();
    await expect(issued).toContainText("Emitidas en el periodo");

    const dashboard = page.waitForResponse((response) => response.url().includes("/api/dashboard?range=all") && response.ok());
    await page.getByRole("radio", { name: "Todo" }).click();
    const body = (await (await dashboard).json()) as { period: { issued: number }; allTime: { total: number } };

    expect(body.period.issued).toBe(body.allTime.total);
    expect(body.allTime.total).toBeGreaterThanOrEqual(24);
    await expect(issued.locator(".figure-value")).toHaveText(String(body.period.issued));
    await expect(page.getByRole("radio", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("heading", { name: "Actividad reciente" })).toBeVisible();
  });

  test("busca, pagina y valida una credencial desde el detalle", async ({ portal: page }) => {
    await page.goto("/certificates");
    await expect(page.getByText(/^1–10 de \d+$/)).toBeVisible();

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page.getByText(/^11–20 de \d+$/)).toBeVisible();

    await page.getByPlaceholder("Titular, título, institución o identificador").fill("DEMO-0022");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("David Acosta");

    await page.getByRole("button", { name: /Más acciones/ }).click();
    await page.getByRole("menuitem", { name: "Validar ahora" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "Credencial revocada" })).toBeVisible();
    await expect(drawer.getByText("Credencial demo: sin ancla en blockchain.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("revoca una credencial off-chain con confirmación y el verificador lo refleja", async ({ portal: page, api }) => {
    const title = uniqueTitle("Revocación E2E");
    const issued = await api.issue(title);

    await page.goto("/certificates");
    await page.getByPlaceholder("Titular, título, institución o identificador").fill(title);
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.getByRole("button", { name: /Más acciones/ }).click();
    await page.getByRole("menuitem", { name: "Revocar" }).click();
    const dialog = page.getByRole("dialog", { name: "Revocar credencial" });
    await expect(dialog.getByText(/solo afecta al registro de\s+CertiChain/)).toBeVisible();
    await dialog.getByLabel(/Motivo de la revocación/).fill("Prueba automatizada de revocación");
    await dialog.getByRole("button", { name: "Revocar credencial" }).click();

    await expect(page.getByText("Credencial revocada.", { exact: true })).toBeVisible();
    await expect(page.locator("tbody tr")).toContainText("Revocada");

    await page.goto(`/verify?id=${issued.id}&autoverify=1`);
    await expect(page.getByRole("heading", { name: "Credencial revocada" })).toBeVisible();
  });

  test("el layout es usable en un teléfono sin scroll horizontal", async ({ portal: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Actividad de emisión" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Abrir menú de navegación" }).click();
    await page.getByRole("link", { name: "Certificados" }).click();
    await expect(page).toHaveURL(/\/certificates$/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
