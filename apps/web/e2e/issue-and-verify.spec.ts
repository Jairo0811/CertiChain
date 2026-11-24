import { readFile } from "node:fs/promises";
import { expect, test, uniqueTitle } from "./fixtures";

/**
 * The core promise of CertiChain, end to end: issue a credential, download its PDF, and prove in
 * the public verifier that the exact file matches the registered SHA-256 while an altered copy
 * does not. Hashing happens in the browser; the test also checks no PDF bytes reach the server.
 */
test("emite, descarga el PDF y lo verifica localmente en el verificador público", async ({ portal: page, context }, testInfo) => {
  const title = uniqueTitle("Ingeniería E2E");

  await page.goto("/certificates/new");
  await expect(page.getByRole("note")).toContainText("Modo off-chain");
  await page.getByLabel("Nombre completo").fill("Laura Méndez");
  await page.getByLabel("Título académico").fill(title);
  await page.getByLabel("Institución emisora").fill("Universidad APEC (UNAPEC)");
  await page.getByLabel("Fecha de emisión").fill("2026-09-15");
  await page.getByRole("button", { name: "Emitir certificado" }).click();

  await expect(page.getByRole("heading", { name: "Certificado emitido" })).toBeVisible();
  const registeredHash = (await page.locator(".facts .mono").nth(1).textContent())?.trim() ?? "";
  expect(registeredHash).toMatch(/^0x[0-9a-f]{64}$/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^certichain-.*\.pdf$/);
  const pdfPath = testInfo.outputPath("certificado.pdf");
  await download.saveAs(pdfPath);

  // The success screen opens the public verifier in a new tab: identifier-only check first.
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: /Abrir en el verificador/ }).click();
  const verifier = await popupPromise;
  await expect(verifier.getByRole("heading", { name: "Credencial pendiente" })).toBeVisible();
  await expect(verifier.getByText(/No se presentó ningún PDF/)).toBeVisible();

  const uploads: string[] = [];
  verifier.on("request", (request) => {
    if (request.postData()) uploads.push(request.url());
  });

  // Files are passed as buffers: setInputFiles silently drops paths with non-ASCII characters
  // (Playwright's output folder is named after this test title, which contains "público").
  const original = await readFile(pdfPath);
  const asPdf = (name: string, buffer: Buffer) => ({ name, mimeType: "application/pdf", buffer });

  // Original PDF: integrity matches.
  await verifier.getByLabel(/PDF del certificado/).setInputFiles(asPdf("certificado.pdf", original));
  await verifier.getByRole("button", { name: "Verificar credencial y PDF" }).click();
  await expect(verifier.getByText(/produce exactamente el SHA-256 registrado/)).toBeVisible();

  // Same PDF with one extra byte: still a PDF, different hash.
  const tampered = Buffer.concat([original, Buffer.from("\n")]);
  await verifier.getByRole("button", { name: "Quitar el PDF seleccionado" }).click();
  await verifier.getByLabel(/PDF del certificado/).setInputFiles(asPdf("certificado-alterado.pdf", tampered));
  await verifier.getByRole("button", { name: "Verificar credencial y PDF" }).click();
  await expect(verifier.getByRole("heading", { name: "El documento no coincide" })).toBeVisible();

  expect(uploads).toEqual([]);
});

test("el verificador distingue una credencial inexistente", async ({ page }) => {
  await page.goto("/verify?id=00000000-0000-4000-8000-000000000000&autoverify=1");
  await expect(page.getByRole("heading", { name: "Credencial no encontrada" })).toBeVisible();
});

test("el verificador rotula el dataset demo como tal", async ({ page }) => {
  await page.goto("/verify?id=DEMO-0001&autoverify=1");
  await expect(page.getByRole("heading", { name: "Credencial vigente" })).toBeVisible();
  await expect(page.getByText("Credencial demo: sin ancla en blockchain.")).toBeVisible();
  await expect(page.getByText(/Ancla en blockchain confirmada/)).toHaveCount(0);
});
