import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/DashboardPage";
import { dashboard, jsonResponse, mockApi, signIn } from "./fixtures";

describe("dashboard", () => {
  it("renders real figures and changes every block when the range changes", async () => {
    signIn();
    const { calls } = mockApi({
      "GET /api/dashboard": (url: URL) =>
        jsonResponse(
          url.searchParams.get("range") === "30"
            ? dashboard({
                range: { key: "30", from: "2026-10-07", to: "2026-11-05", dateBasis: "issuedAt", granularity: "day" },
                period: { issued: 2, active: 1, pending: 1, revoked: 0, institutions: 1, revocationsInRange: 0, onChain: 0 },
                byInstitution: [{ institution: "ITLA", issued: 2 }],
                activity: [],
              })
            : dashboard(),
        ),
    });
    render(<DashboardPage onOpenCertificate={vi.fn()} onIssue={vi.fn()} />);

    const strip = await screen.findByRole("region", { name: "Indicadores del periodo" });
    expect(within(strip).getByText("12")).toBeInTheDocument();
    expect(screen.getByText("UNAPEC")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "30 días" }));
    await waitFor(() => expect(within(strip).getByText("2")).toBeInTheDocument());
    expect(screen.getByText("ITLA")).toBeInTheDocument();
    expect(screen.getByText("Sin eventos en este periodo")).toBeInTheDocument();
    expect(calls.map((call) => call.url.searchParams.get("range"))).toEqual(["90", "30"]);
    expect(screen.getByRole("radio", { name: "30 días" })).toHaveAttribute("aria-checked", "true");
  });

  it("does not invent a trend without previous-period data, and shows it when available", async () => {
    signIn();
    mockApi({ "GET /api/dashboard": dashboard({ trend: null }) });
    const { unmount } = render(<DashboardPage onOpenCertificate={vi.fn()} onIssue={vi.fn()} />);
    expect(await screen.findByText("30 en todo el registro")).toBeInTheDocument();
    expect(screen.queryByText(/%\s+frente a/)).not.toBeInTheDocument();
    unmount();

    mockApi({ "GET /api/dashboard": dashboard({ trend: { previousIssued: 8, changePercent: 50 } }) });
    render(<DashboardPage onOpenCertificate={vi.fn()} onIssue={vi.fn()} />);
    expect(await screen.findByText("+50 % frente a 8 del periodo anterior")).toBeInTheDocument();
  });

  it("labels revocation activity from audit events and opens the credential", async () => {
    signIn();
    mockApi({ "GET /api/dashboard": dashboard() });
    const onOpen = vi.fn();
    render(<DashboardPage onOpenCertificate={onOpen} onIssue={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Credencial revocada" }));
    expect(onOpen).toHaveBeenCalledWith("cert-1");
  });

  it("shows empty and error states", async () => {
    signIn();
    mockApi({
      "GET /api/dashboard": dashboard({
        period: { issued: 0, active: 0, pending: 0, revoked: 0, institutions: 0, revocationsInRange: 0, onChain: 0 },
        byInstitution: [],
        activity: [],
      }),
    });
    const { unmount } = render(<DashboardPage onOpenCertificate={vi.fn()} onIssue={vi.fn()} />);
    expect(await screen.findByText("Sin emisiones en este periodo")).toBeInTheDocument();
    unmount();

    mockApi({ "GET /api/dashboard": () => Promise.reject(new TypeError("Failed to fetch")) });
    render(<DashboardPage onOpenCertificate={vi.fn()} onIssue={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible conectar con la API");
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
  });
});
