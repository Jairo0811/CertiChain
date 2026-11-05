import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import { CertificatesPage } from "../pages/CertificatesPage";
import type { Certificate } from "../types";
import { certificate, jsonResponse, mockApi, signIn } from "./fixtures";

const admin = { id: "local-admin", email: "admin@certichain.local", role: "admin" as const };

function page(items: Certificate[], total = items.length, pageNumber = 1) {
  return { items, total, page: pageNumber, pageSize: 10, totalPages: Math.max(1, Math.ceil(total / 10)) };
}

function renderPage(openId: { id: string; validate?: boolean } | null = null, onOpenChange = vi.fn()) {
  return render(
    <ToastProvider>
      <CertificatesPage user={admin} openId={openId} onOpenChange={onOpenChange} onIssue={vi.fn()} />
    </ToastProvider>,
  );
}

describe("certificate management", () => {
  it("lists with server-side pagination, sorting and debounced search", async () => {
    signIn();
    const first = Array.from({ length: 10 }, () => certificate());
    const second = [certificate({ studentName: "Última Persona" })];
    const { calls } = mockApi({
      "GET /api/certificates": (url: URL) => jsonResponse(url.searchParams.get("page") === "2" ? page(second, 11, 2) : page(first, 11)),
    });
    renderPage();

    expect(await screen.findByText("1–10 de 11")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);

    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(await screen.findByText("Última Persona")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /^Titular/ }));
    await waitFor(() => expect(calls.at(-1)!.url.searchParams.get("sort")).toBe("studentName"));
    expect(screen.getByRole("columnheader", { name: /Titular/ })).toHaveAttribute("aria-sort", "ascending");

    await userEvent.type(screen.getByPlaceholderText("Titular, título, institución o identificador"), "DEMO-0021");
    await waitFor(() => expect(calls.at(-1)!.url.searchParams.get("search")).toBe("DEMO-0021"));
    expect(calls.at(-1)!.url.searchParams.get("page")).toBe("1");
  });

  it("distinguishes an empty registry from a search without results", async () => {
    signIn();
    mockApi({ "GET /api/certificates": page([]) });
    const { unmount } = renderPage();
    expect(await screen.findByText("Todavía no hay certificados")).toBeInTheDocument();
    unmount();

    mockApi({ "GET /api/certificates": page([]) });
    renderPage();
    await screen.findByText("Todavía no hay certificados");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por estado"), "revoked");
    expect(await screen.findByText("Ningún certificado coincide")).toBeInTheDocument();
  });

  it("requires a reason and typed confirmation to revoke an on-chain credential", async () => {
    signIn();
    const anchored = certificate({
      evidenceMode: "on-chain",
      statusManagedByBlockchain: true,
      blockchainId: `0x${"e".repeat(64)}`,
      chainSyncStatus: "anchored",
    });
    const { calls } = mockApi({
      "GET /api/certificates": page([anchored]),
      "POST /api/certificates/:id/revoke": () => jsonResponse({ ...anchored, status: "revoked" }),
    });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Más acciones/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Revocar" }));
    const dialog = screen.getByRole("dialog", { name: "Revocar credencial" });
    expect(within(dialog).getByText(/permanente/)).toBeInTheDocument();
    // Delete is not offered for blockchain-bound credentials.
    const confirm = within(dialog).getByRole("button", { name: "Revocar credencial" });
    expect(confirm).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Motivo de la revocación"), "Datos incorrectos en el título");
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/para confirmar/), "REVOCAR");
    await userEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Credencial revocada en blockchain y en el registro.")).toBeInTheDocument();
    const revoke = calls.find((call) => call.method === "POST");
    expect(revoke?.body).toEqual({ reason: "Datos incorrectos en el título" });
  });

  it("never offers deletion for blockchain-bound credentials", async () => {
    signIn();
    mockApi({ "GET /api/certificates": page([certificate({ evidenceMode: "on-chain", statusManagedByBlockchain: true })]) });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Más acciones/ }));
    expect(screen.queryByRole("menuitem", { name: /Eliminar/ })).not.toBeInTheDocument();
  });

  it("deletes an off-chain test credential only after typing ELIMINAR, and reports API conflicts", async () => {
    signIn();
    const local = certificate();
    let attempt = 0;
    mockApi({
      "GET /api/certificates": page([local]),
      "DELETE /api/certificates/:id": () => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ error: "A blockchain-bound certificate cannot be deleted.", code: "conflict" }, 409)
          : jsonResponse({ deleted: true, id: local.id, evidenceDeleted: true });
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Más acciones/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Eliminar (datos de prueba)" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar credencial de prueba" });
    await userEvent.type(within(dialog).getByLabelText(/para confirmar/), "eliminar");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar definitivamente" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("no puede eliminarse");

    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar definitivamente" }));
    expect(await screen.findByText("Credencial de prueba y su PDF cifrado eliminados.")).toBeInTheDocument();
  });

  it("downloads the PDF through the authenticated endpoint", async () => {
    signIn();
    const local = certificate({ title: "Ingeniería de Software" });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pdf");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { calls } = mockApi({
      "GET /api/certificates": page([local]),
      "GET /api/certificates/:id/pdf": () => new Response(new Blob(["%PDF-1.4"]), { status: 200, headers: { "Content-Type": "application/pdf" } }),
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Más acciones/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Descargar PDF" }));
    expect(await screen.findByText(/PDF descargado/)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    const download = calls.find((call) => call.url.pathname.endsWith("/pdf"));
    expect(download).toBeDefined();
  });

  it("shows a retryable error when the API is unreachable", async () => {
    signIn();
    mockApi({ "GET /api/certificates": () => Promise.reject(new TypeError("Failed to fetch")) });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible conectar con la API");
  });

  it("validates from the drawer without sending any document hash", async () => {
    signIn();
    const local = certificate({ status: "pending" });
    const { calls } = mockApi({
      "GET /api/certificates": page([local]),
      "GET /api/certificates/:id": { ...local, history: [] },
      "GET /api/verify/:id": {
        valid: false,
        outcome: "pending",
        evidenceMode: "off-chain",
        verifiedAt: "2026-11-05T10:00:00.000Z",
        certificate: { id: local.id, studentName: "E*", title: local.title, institution: "UNAPEC", issuedAt: local.issuedAt, status: "pending", evidenceMode: "off-chain" },
        checks: {
          existsOffChain: true,
          registryStatus: "pending",
          integrity: "not_evaluated",
          hashSource: "none",
          hashMatches: null,
          blockchainStatus: "not_anchored",
          statusManagedByBlockchain: false,
        },
      },
    });
    renderPage({ id: local.id, validate: true });
    expect(await screen.findByRole("heading", { name: "Credencial pendiente" })).toBeInTheDocument();
    const verify = calls.find((call) => call.url.pathname.startsWith("/api/verify/"));
    expect(verify?.url.searchParams.has("hash")).toBe(false);
    expect(calls.some((call) => call.url.pathname.endsWith("/evidence"))).toBe(false);
  });

  it("closes the drawer with Escape and keeps focus management in the dialog", async () => {
    signIn();
    const local = certificate();
    const onOpenChange = vi.fn();
    mockApi({ "GET /api/certificates": page([local]), "GET /api/certificates/:id": { ...local, history: [] } });
    renderPage({ id: local.id }, onOpenChange);
    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(null);
  });
});
