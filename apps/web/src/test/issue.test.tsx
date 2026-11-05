import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import { IssuePage, validateIssue } from "../pages/IssuePage";
import { certificate, jsonResponse, mockApi, signIn } from "./fixtures";

function renderIssue() {
  return render(
    <ToastProvider>
      <IssuePage onOpenCertificate={vi.fn()} />
    </ToastProvider>,
  );
}

async function fill(wallet?: string) {
  await userEvent.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  if (wallet) await userEvent.type(screen.getByLabelText(/Wallet del titular/), wallet);
  await userEvent.type(screen.getByLabelText("Título académico"), "Ingeniería de Software");
  await userEvent.type(screen.getByLabelText("Institución emisora"), "UNAPEC");
  fireEvent.change(screen.getByLabelText("Fecha de emisión"), { target: { value: "2026-09-01" } });
}

describe("certificate issuance", () => {
  it("validates input locally", () => {
    const base = { studentName: "Ana", studentWallet: "", title: "Ingeniería", institution: "UNAPEC", issuedAt: "2026-09-01" };
    expect(validateIssue(base, false)).toEqual({});
    expect(validateIssue(base, true).studentWallet).toMatch(/obligatoria/);
    expect(validateIssue({ ...base, studentWallet: "0x123" }, false).studentWallet).toMatch(/40 caracteres/);
    expect(validateIssue({ ...base, issuedAt: "2999-01-01" }, false).issuedAt).toMatch(/futura/);
    expect(validateIssue({ ...base, studentName: " " }, false).studentName).toBeDefined();
  });

  it("issues off-chain, labels the technical identifier honestly and shows the result", async () => {
    signIn();
    const created = certificate({ status: "pending", studentName: "Ana Pérez", title: "Ingeniería de Software" });
    const { calls } = mockApi({
      "GET /health": { status: "ok", persistence: "json", storage: "local", blockchainConfigured: false },
      "POST /api/certificates": () => jsonResponse(created, 201),
    });
    renderIssue();
    expect(await screen.findByText(/Modo off-chain/)).toBeInTheDocument();
    expect(screen.getByText(/No es una wallet del estudiante/)).toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Emitir certificado" }));

    expect(await screen.findByRole("heading", { name: "Certificado emitido" })).toBeInTheDocument();
    expect(screen.getByText(created.id)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir en el verificador/ })).toHaveAttribute(
      "href",
      `/verify?id=${created.id}&autoverify=1`,
    );
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      studentName: "Ana Pérez",
      title: "Ingeniería de Software",
      institution: "UNAPEC",
      issuedAt: "2026-09-01",
    });
  });

  it("requires the holder wallet in blockchain mode and maps server checksum errors to the field", async () => {
    signIn();
    mockApi({
      "GET /health": { status: "ok", persistence: "postgres", storage: "ipfs", blockchainConfigured: true },
      "POST /api/certificates": () =>
        jsonResponse(
          {
            error: "Invalid certificate payload",
            code: "validation_failed",
            details: { fieldErrors: { studentWallet: ["bad"] } },
          },
          400,
        ),
    });
    renderIssue();
    expect(await screen.findByText(/Modo blockchain/)).toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Emitir certificado" }));
    expect(screen.getByText("En modo blockchain la wallet del titular es obligatoria.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Wallet del titular/), "0x8BA1f109551bD432803012645Ac136ddd64DBA72");
    await userEvent.click(screen.getByRole("button", { name: "Emitir certificado" }));
    expect(await screen.findByText(/checksum EIP-55/)).toBeInTheDocument();
  });

  it("prevents duplicate submissions while a request is in flight", async () => {
    signIn();
    let resolve: (value: Response) => void = () => undefined;
    const { calls } = mockApi({
      "GET /health": { status: "ok", persistence: "json", storage: "local", blockchainConfigured: false },
      "POST /api/certificates": () => new Promise<Response>((done) => (resolve = done)),
    });
    renderIssue();
    await screen.findByText(/Modo off-chain/);
    await fill();
    const button = screen.getByRole("button", { name: "Emitir certificado" });
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: /Emitiendo/ })).toBeDisabled());
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    resolve(jsonResponse(certificate(), 201));
    expect(await screen.findByRole("heading", { name: "Certificado emitido" })).toBeInTheDocument();
  });

  it("explains a pending blockchain anchor instead of claiming success", async () => {
    signIn();
    mockApi({
      "GET /health": { status: "ok", persistence: "postgres", storage: "ipfs", blockchainConfigured: true },
      "POST /api/certificates": () => jsonResponse(certificate({ status: "pending", chainSyncStatus: "failed" }), 202),
    });
    renderIssue();
    await screen.findByText(/Modo blockchain/);
    await fill("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    await userEvent.click(screen.getByRole("button", { name: "Emitir certificado" }));
    expect(await screen.findByRole("heading", { name: "Certificado registrado, anclaje pendiente" })).toBeInTheDocument();
    expect(screen.getByText(/No se reenviará ninguna transacción/)).toBeInTheDocument();
  });
});
