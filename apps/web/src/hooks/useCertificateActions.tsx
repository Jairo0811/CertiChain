import { useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { messageFor } from "../lib/api";
import { saveBlob } from "../lib/download";
import { pdfFilename, publicId } from "../lib/format";
import { certificateService } from "../services";
import type { Certificate } from "../types";

type Pending = { kind: "revoke" | "delete"; certificate: Certificate } | null;

/**
 * Certificate operations shared by the table and the detail drawer. Destructive operations go
 * through ConfirmDialog; every outcome is announced via the toast live region and followed by
 * `onChanged` so lists and the dashboard refresh from the server.
 */
export function useCertificateActions(onChanged: (certificate?: Certificate, removedId?: string) => void) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  async function downloadPdf(certificate: Certificate) {
    setWorking(`pdf:${certificate.id}`);
    try {
      let target = certificate;
      if (!target.documentAvailable) {
        target = await certificateService.ensurePdf(certificate.id);
        onChanged(target);
      }
      saveBlob(await certificateService.downloadPdf(target.id), pdfFilename(target));
      toast("PDF descargado. Su SHA-256 se comprobó antes de entregarlo.");
    } catch (reason) {
      toast(messageFor(reason, "No fue posible descargar el PDF."), "error");
    } finally {
      setWorking(null);
    }
  }

  async function anchor(certificate: Certificate) {
    setWorking(`anchor:${certificate.id}`);
    try {
      const updated = await certificateService.anchor(certificate.id);
      onChanged(updated);
      toast(
        updated.chainSyncStatus === "anchored"
          ? "Credencial anclada en blockchain y activada."
          : "La transacción sigue pendiente de confirmación. Vuelve a sincronizar en unos minutos.",
        updated.chainSyncStatus === "anchored" ? "success" : "info",
      );
    } catch (reason) {
      toast(messageFor(reason, "No fue posible sincronizar con blockchain."), "error");
    } finally {
      setWorking(null);
    }
  }

  async function confirm(reason?: string) {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      if (pending.kind === "revoke") {
        const updated = await certificateService.revoke(pending.certificate.id, reason);
        onChanged(updated);
        toast(
          updated.evidenceMode === "on-chain" ? "Credencial revocada en blockchain y en el registro." : "Credencial revocada.",
        );
      } else {
        const result = await certificateService.remove(pending.certificate.id);
        onChanged(undefined, pending.certificate.id);
        toast(
          result.evidenceDeleted
            ? "Credencial de prueba y su PDF cifrado eliminados."
            : "Credencial de prueba eliminada del registro.",
        );
      }
      setPending(null);
    } catch (reason) {
      setError(messageFor(reason, "La operación no pudo completarse."));
    } finally {
      setBusy(false);
    }
  }

  const dialog = pending && (
    <ConfirmDialog
      title={pending.kind === "revoke" ? "Revocar credencial" : "Eliminar credencial de prueba"}
      confirmLabel={pending.kind === "revoke" ? "Revocar credencial" : "Eliminar definitivamente"}
      requireReason={
        pending.kind === "revoke" ? (pending.certificate.evidenceMode === "on-chain" ? "required" : "optional") : undefined
      }
      reasonLabel="Motivo de la revocación"
      reasonHint="Queda registrado en la auditoría."
      confirmWord={
        pending.kind === "delete" || pending.certificate.evidenceMode === "on-chain"
          ? pending.kind === "delete"
            ? "ELIMINAR"
            : "REVOCAR"
          : undefined
      }
      busy={busy}
      error={error}
      onCancel={() => {
        setPending(null);
        setError("");
      }}
      onConfirm={(reason) => void confirm(reason)}
    >
      <p>
        <strong>{pending.certificate.title}</strong>, {pending.certificate.studentName}
        <br />
        <span className="mono small">{publicId(pending.certificate)}</span>
      </p>
      {pending.kind === "revoke" && pending.certificate.evidenceMode === "on-chain" && (
        <p className="callout danger">
          Se enviará una transacción al contrato CertificateRegistry. La revocación on-chain es <strong>permanente</strong>: no
          podrá reactivarse ni eliminarse.
        </p>
      )}
      {pending.kind === "revoke" && pending.certificate.evidenceMode !== "on-chain" && (
        <p className="callout warning">
          Credencial {pending.certificate.evidenceMode === "demo" ? "demo" : "off-chain"}: la revocación solo afecta al registro
          de CertiChain. Los verificadores la verán como revocada de inmediato.
        </p>
      )}
      {pending.kind === "delete" && (
        <p className="callout danger">
          Pensado para limpiar datos de prueba. Se borra el registro{" "}
          {pending.certificate.documentAvailable ? "y su PDF cifrado local " : ""}
          de forma irreversible; la auditoría conserva el evento de eliminación.
        </p>
      )}
    </ConfirmDialog>
  );

  return {
    working,
    dialog,
    downloadPdf,
    anchor,
    requestRevoke: (certificate: Certificate) => setPending({ kind: "revoke", certificate }),
    requestDelete: (certificate: Certificate) => setPending({ kind: "delete", certificate }),
  };
}

export function canDelete(certificate: Certificate): boolean {
  return !certificate.statusManagedByBlockchain;
}

export function canGeneratePdf(certificate: Certificate): boolean {
  return (
    certificate.documentAvailable ||
    (certificate.status === "pending" && !certificate.blockchainId && !certificate.statusManagedByBlockchain)
  );
}

export function needsAnchoring(certificate: Certificate): boolean {
  return ["failed", "submitted", "submitting"].includes(certificate.chainSyncStatus ?? "");
}
