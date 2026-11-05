import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { dashboard, jsonResponse, mockApi, session, signIn } from "./fixtures";

const health = { status: "ok", persistence: "json", storage: "local", blockchainConfigured: false };

describe("login and session", () => {
  it("validates fields before calling the API", async () => {
    const { calls } = mockApi({});
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(screen.getByText("Introduce tu correo institucional.")).toBeInTheDocument();
    expect(screen.getByText("Introduce tu contraseña.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Correo institucional"), "no-es-correo");
    expect(screen.getByText("El correo no tiene un formato válido.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("toggles password visibility accessibly", async () => {
    mockApi({});
    render(<App />);
    const password = screen.getByLabelText("Contraseña", { selector: "input" });
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a generic error for invalid credentials and clears the password", async () => {
    mockApi({
      "POST /api/auth/login": () => jsonResponse({ error: "Invalid email or password", code: "invalid_credentials" }, 401),
    });
    render(<App />);
    await userEvent.type(screen.getByLabelText("Correo institucional"), "admin@certichain.local");
    await userEvent.type(screen.getByLabelText("Contraseña", { selector: "input" }), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByLabelText("Contraseña", { selector: "input" })).toHaveValue("");
  });

  it("explains rate limiting and network failures", async () => {
    mockApi({ "POST /api/auth/login": () => jsonResponse({ error: "Too many", code: "rate_limited" }, 429) });
    render(<App />);
    await userEvent.type(screen.getByLabelText("Correo institucional"), "admin@certichain.local");
    await userEvent.type(screen.getByLabelText("Contraseña", { selector: "input" }), "CertiChain123!");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });

  it("signs in, stores the session and opens the dashboard", async () => {
    mockApi({
      "POST /api/auth/login": session(),
      "GET /health": health,
      "GET /api/dashboard": dashboard(),
    });
    render(<App />);
    await userEvent.type(screen.getByLabelText("Correo institucional"), "admin@certichain.local");
    await userEvent.type(screen.getByLabelText("Contraseña", { selector: "input" }), "CertiChain123!");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("heading", { name: "Actividad de emisión" })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("certichain-session")!).token).toBe("test-token");
  });

  it("returns to the login with a notice when the API reports an expired session", async () => {
    signIn();
    mockApi({
      "GET /health": health,
      "GET /api/dashboard": () => jsonResponse({ error: "Session expired", code: "session_expired" }, 401),
    });
    render(<App />);
    expect(await screen.findByText("Tu sesión expiró. Inicia sesión de nuevo para continuar.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Portal institucional" })).toBeInTheDocument();
    expect(sessionStorage.getItem("certichain-session")).toBeNull();
  });

  it("discards a stored session that has already expired", async () => {
    signIn(session({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    mockApi({});
    render(<App />);
    expect(screen.getByRole("heading", { name: "Portal institucional" })).toBeInTheDocument();
  });

  it("logs out from the shell", async () => {
    signIn();
    mockApi({ "GET /health": health, "GET /api/dashboard": dashboard() });
    render(<App />);
    await screen.findByRole("heading", { name: "Actividad de emisión" });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Portal institucional" })).toBeInTheDocument());
    expect(sessionStorage.getItem("certichain-session")).toBeNull();
  });
});
