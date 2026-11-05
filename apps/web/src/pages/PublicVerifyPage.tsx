import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { type HashSource, VerificationResult } from "../components/verify/VerificationResult";
import { Brand, Spinner } from "../components/ui/Feedback";
import { Field } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { ApiError, messageFor } from "../lib/api";
import { LocalFileError, sha256File } from "../lib/crypto";
import { OUTCOME_COPY } from "../lib/format";
import { verificationService } from "../services";
import type { Verification } from "../types";

type ResultState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "done"; result: Verification; source?: HashSource }
  | { kind: "not_found"; id: string }
  | { kind: "error"; message: string };

const HASH = /^0x[a-fA-F0-9]{64}$/;

function transportNote(): { secure: boolean; text: string } | null {
  if (window.location.protocol === "https:") return { secure: true, text: "Conexión cifrada (HTTPS)" };
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return { secure: false, text: "Entorno local sin HTTPS" };
  return { secure: false, text: "Conexión sin cifrar" };
}

/**
 * Public verifier. Supports:
 * - /verify?id=<id or blockchain id>&autoverify=1  (current QR codes)
 * - /verify?id=<id>&hash=<sha256>                  (legacy links; hash labelled as coming from the link)
 * An optional local PDF is hashed in the browser and only its SHA-256 is sent.
 */
export function PublicVerifyPage() {
  const initial = useRef(new URLSearchParams(window.location.search));
  const [certificateId, setCertificateId] = useState(initial.current.get("id")?.trim() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [state, setState] = useState<ResultState>({ kind: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const transport = transportNote();

  const run = useCallback(async (id: string, selectedFile: File | null, linkHash?: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setFileError("");

    let hash: string | undefined;
    let source: HashSource | undefined;
    if (selectedFile) {
      setState({ kind: "loading", message: "Calculando el SHA-256 del PDF en tu navegador…" });
      try {
        hash = await sha256File(selectedFile);
        source = { kind: "file", name: selectedFile.name };
      } catch (error) {
        setFileError(error instanceof LocalFileError ? error.message : "No se pudo leer el archivo.");
        setState({ kind: "idle" });
        return;
      }
    } else if (linkHash && HASH.test(linkHash)) {
      hash = linkHash;
      source = { kind: "link" };
    }

    setState({ kind: "loading", message: "Consultando el registro y la blockchain…" });
    try {
      const result = hash ? await verificationService.withDocumentHash(trimmed, hash) : await verificationService.byId(trimmed);
      setState({ kind: "done", result, source });
      const next = new URL(window.location.href);
      next.search = new URLSearchParams({ id: trimmed }).toString();
      window.history.replaceState({}, "", next);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") setState({ kind: "not_found", id: trimmed });
      else setState({ kind: "error", message: messageFor(error, "No fue posible completar la verificación.") });
    }
    window.requestAnimationFrame(() => resultRef.current?.focus());
  }, []);

  useEffect(() => {
    const params = initial.current;
    const id = params.get("id")?.trim();
    const legacyHash = params.get("hash")?.trim() ?? undefined;
    if (id && (params.get("autoverify") === "1" || legacyHash)) void run(id, null, legacyHash);
  }, [run]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run(certificateId, file);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setFileError("");
    if (state.kind !== "idle") setState({ kind: "idle" });
  }

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const busy = state.kind === "loading";

  return (
    <div className="public-page">
      <header className="public-header">
        <a href="/verify" className="brand-link" aria-label="CertiChain, verificador público">
          <Brand />
        </a>
        <a href="/" className="button ghost small">
          <Icon name="lock" size={16} /> Acceso institucional
        </a>
      </header>

      <main className="public-main" id="main">
        <section className="public-intro">
          <h1>Comprueba una credencial académica</h1>
          <p className="lead">
            Introduce el identificador impreso en el certificado o abre el enlace de su código QR. Si tienes el PDF, añádelo para
            comprobar que es exactamente el documento emitido.
          </p>

          <ul className="assurance-list">
            <li>
              <Icon name="database" />
              <div>
                <strong>Registro institucional</strong>
                <p>Confirma que la credencial existe y si está vigente, pendiente o revocada.</p>
              </div>
            </li>
            <li>
              <Icon name="fingerprint" />
              <div>
                <strong>Integridad del PDF</strong>
                <p>Tu navegador calcula el SHA-256 del archivo. El documento nunca sale de tu equipo.</p>
              </div>
            </li>
            <li>
              <Icon name="chain" />
              <div>
                <strong>Ancla en blockchain</strong>
                <p>
                  Si la credencial fue anclada, consulta el contrato. Las credenciales demo u off-chain se indican como tales.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="public-panel" aria-label="Verificador">
          <form className="stack" onSubmit={onSubmit} noValidate>
            <Field label="Identificador de la credencial" hint="Aparece bajo el código QR del certificado.">
              {(field) => (
                <input
                  {...field}
                  value={certificateId}
                  onChange={(event) => {
                    setCertificateId(event.target.value);
                    if (state.kind !== "idle" && state.kind !== "loading") setState({ kind: "idle" });
                  }}
                  placeholder="ID, Blockchain ID o DEMO-0001"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  maxLength={128}
                />
              )}
            </Field>

            <div className="field">
              <span className="field-label" id="pdf-label">
                PDF del certificado <span className="field-optional">(opcional)</span>
              </span>
              {file ? (
                <div className="file-chip">
                  <Icon name="file" />
                  <span className="file-name">{file.name}</span>
                  <button type="button" className="icon-button" onClick={clearFile} aria-label="Quitar el PDF seleccionado">
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ) : (
                <label className="dropzone">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={onFile}
                    aria-labelledby="pdf-label"
                  />
                  <Icon name="upload" />
                  <span>
                    <strong>Seleccionar PDF</strong>
                    <small>Se analiza localmente; no se sube al servidor.</small>
                  </span>
                </label>
              )}
              {fileError && (
                <span className="inline-error" role="alert">
                  {fileError}
                </span>
              )}
            </div>

            <button type="submit" className="button primary block" disabled={busy || !certificateId.trim()} aria-busy={busy}>
              <Icon name="verify" /> {busy ? "Verificando…" : file ? "Verificar credencial y PDF" : "Verificar credencial"}
            </button>
            {transport && (
              <p className={`transport ${transport.secure ? "secure" : ""}`}>
                <Icon name={transport.secure ? "lock" : "info"} size={14} /> {transport.text}
              </p>
            )}
          </form>

          <div ref={resultRef} tabIndex={-1} className="result-region" aria-live="polite">
            {state.kind === "loading" && (
              <div className="loading-line">
                <Spinner label={state.message} /> {state.message}
              </div>
            )}
            {state.kind === "done" && <VerificationResult result={state.result} source={state.source} />}
            {state.kind === "not_found" && (
              <section className="verdict tone-danger">
                <div className="verdict-seal">
                  <span className="seal-mark" aria-hidden="true">
                    <Icon name="cross" size={26} />
                  </span>
                  <div>
                    <h2 className="verdict-title">{OUTCOME_COPY.not_found.title}</h2>
                    <p className="verdict-body">{OUTCOME_COPY.not_found.body}</p>
                  </div>
                </div>
              </section>
            )}
            {state.kind === "error" && (
              <p className="inline-error" role="alert">
                {state.message}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <span>CertiChain es un proyecto académico de Fundamentos de Seguridad de Software (ISO-915), UNAPEC.</span>
        <span>Los datos personales completos nunca se publican en blockchain.</span>
      </footer>
    </div>
  );
}
