import { FormEvent, ReactNode, useState } from "react";
import { Dialog } from "./Dialog";
import { Field } from "./Field";

/**
 * Explicit confirmation for destructive or irreversible operations. Optionally requires a
 * written reason and/or typing a confirmation word before the action is enabled.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = "danger",
  requireReason,
  reasonLabel = "Motivo",
  reasonHint,
  confirmWord,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  requireReason?: "required" | "optional";
  reasonLabel?: string;
  reasonHint?: string;
  confirmWord?: string;
  busy?: boolean;
  error?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const reasonValid = requireReason !== "required" || reason.trim().length >= 5;
  const wordValid = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!reasonValid || !wordValid || busy) return;
    onConfirm(reason.trim() || undefined);
  }

  return (
    <Dialog title={title} onClose={onCancel} size="sm" dismissible={!busy}>
      <form className="stack" onSubmit={submit}>
        <div className="confirm-body">{children}</div>
        {requireReason && (
          <Field label={reasonLabel} optional={requireReason === "optional"} hint={reasonHint}>
            {(field) => (
              <textarea
                {...field}
                data-autofocus
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={requireReason === "required"}
                minLength={requireReason === "required" ? 5 : undefined}
              />
            )}
          </Field>
        )}
        {confirmWord && (
          <Field label={`Escribe ${confirmWord} para confirmar`}>
            {(field) => (
              <input
                {...field}
                className="mono"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                data-autofocus={!requireReason || undefined}
              />
            )}
          </Field>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row end">
          <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className={`button ${tone}`} disabled={!reasonValid || !wordValid || busy} aria-busy={busy}>
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
