import { createHash } from "node:crypto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { buildChecks } from "../components/verify/VerificationResult";
import { PublicVerifyPage } from "../pages/PublicVerifyPage";
import { jsonResponse, mockApi, verification } from "./fixtures";

describe("public verifier", () => {
  it("auto-verifies a QR link by identifier only and never fetches the registry hash", async () => {
    window.history.replaceState({}, "", "/verify?id=cert-1&autoverify=1");
    const { calls } = mockApi({ "GET /api/verify/:id": verification() });
    render(<PublicVerifyPage />);

    expect(await screen.findByRole("heading", { name: "Credencial vigente" })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.pathname).toBe("/api/verify/cert-1");
    expect(calls[0]!.url.searchParams.has("hash")).toBe(false);
    expect(screen.getByText(/No se presentó ningún PDF/)).toBeInTheDocument();
    expect(screen.getAllByText("No evaluada")).toHaveLength(2);
    expect(window.location.search).toBe("?id=cert-1");
  });

  it("hashes a local PDF in the browser and sends only its SHA-256", async () => {
    window.history.replaceState({}, "", "/verify");
    const bytes = new TextEncoder().encode("%PDF-1.4 CertiChain test document");
    const expected = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    const { calls } = mockApi({
      "GET /api/verify/:id": verification({}, { integrity: "match", hashSource: "verifier", hashMatches: true }),
    });
    render(<PublicVerifyPage />);

    await userEvent.type(screen.getByLabelText("Identificador de la credencial"), "cert-1");
    const file = new File([bytes], "titulo.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/PDF del certificado/), file);
    expect(screen.getByText("titulo.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Verificar credencial y PDF" }));

    expect(await screen.findByText(/produce exactamente el SHA-256 registrado/)).toBeInTheDocument();
    expect(calls[0]!.url.searchParams.get("hash")).toBe(expected);
    expect(calls.every((call) => call.body === undefined)).toBe(true);
  });

  it("rejects non-PDF files locally", async () => {
    window.history.replaceState({}, "", "/verify");
    const { calls } = mockApi({});
    render(<PublicVerifyPage />);
    await userEvent.type(screen.getByLabelText("Identificador de la credencial"), "cert-1");
    await userEvent.upload(screen.getByLabelText(/PDF del certificado/), new File(["MZ binary"], "virus.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Verificar credencial y PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no es un PDF válido");
    expect(calls).toHaveLength(0);
  });

  it("reports a document mismatch, revocation and not-found distinctly", async () => {
    window.history.replaceState({}, "", "/verify?id=cert-1&autoverify=1");
    mockApi({ "GET /api/verify/:id": verification({ valid: false, outcome: "revoked" }, { registryStatus: "revoked" }) });
    const { unmount } = render(<PublicVerifyPage />);
    expect(await screen.findByRole("heading", { name: "Credencial revocada" })).toBeInTheDocument();
    unmount();

    window.history.replaceState({}, "", "/verify?id=missing&autoverify=1");
    mockApi({ "GET /api/verify/:id": () => jsonResponse({ valid: false, outcome: "not_found", code: "not_found" }, 404) });
    render(<PublicVerifyPage />);
    expect(await screen.findByRole("heading", { name: "Credencial no encontrada" })).toBeInTheDocument();
  });

  it("does not claim blockchain authenticity when the chain is unreachable", async () => {
    window.history.replaceState({}, "", "/verify?id=cert-1&autoverify=1");
    mockApi({
      "GET /api/verify/:id": verification(
        { valid: false, outcome: "blockchain_unavailable", evidenceMode: "on-chain" },
        { blockchainStatus: "unavailable", statusManagedByBlockchain: true },
      ),
    });
    render(<PublicVerifyPage />);
    expect(await screen.findByRole("heading", { name: "Blockchain temporalmente inaccesible" })).toBeInTheDocument();
    expect(screen.getByText("Red blockchain inaccesible ahora mismo.")).toBeInTheDocument();
    expect(screen.queryByText(/Ancla en blockchain confirmada/)).not.toBeInTheDocument();
  });

  it("labels legacy hash links as link checks, not document checks", async () => {
    const hash = `0x${"ab".repeat(32)}`;
    window.history.replaceState({}, "", `/verify?id=DEMO-0001&hash=${hash}`);
    const { calls } = mockApi({
      "GET /api/verify/:id": verification({ evidenceMode: "demo" }, { integrity: "match", hashSource: "verifier", hashMatches: true, blockchainStatus: "demo" }),
    });
    render(<PublicVerifyPage />);
    expect(await screen.findByText("SHA-256 del enlace")).toBeInTheDocument();
    expect(screen.getByText(/valida el enlace, no un archivo/)).toBeInTheDocument();
    expect(screen.getByText("Credencial demo: sin ancla en blockchain.")).toBeInTheDocument();
    await waitFor(() => expect(calls[0]!.url.searchParams.get("hash")).toBe(hash));
  });

  it("builds separate checks without overstating integrity", () => {
    const checks = buildChecks(verification());
    expect(checks.map((check) => [check.key, check.state])).toEqual([
      ["registry", "ok"],
      ["integrity", "skip"],
      ["blockchain", "skip"],
    ]);
  });
});
