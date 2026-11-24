import { useState } from "react";
import { MobileApiError, verifyCredential } from "../lib/api";
import { snapshotFromVerification } from "../lib/snapshot";
import { credentialId, upsertWalletCredential } from "../lib/wallet";
import type { ConnectionState, Verification, WalletCredential } from "../types";

export type Outcome = {
  kind: "result" | "not_found" | "error";
  verification?: Verification;
  hashSource?: "link" | "none";
  message?: string;
};

/**
 * Verification flow: calls the API, stores the real result in the wallet and reports the
 * refreshed credential so an open detail view shows the new state.
 */
export function useVerifier({
  wallet,
  persist,
  setConnection,
  onCredentialUpdated,
}: {
  wallet: WalletCredential[];
  persist: (next: WalletCredential[], previous: WalletCredential[]) => Promise<void>;
  setConnection: (state: ConnectionState) => void;
  onCredentialUpdated: (credential: WalletCredential) => void;
}) {
  const [certificateId, setCertificateId] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify(id = certificateId, suppliedHash?: string) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      setOutcome({ kind: "error", message: "Introduce el ID o Blockchain ID de la credencial." });
      return;
    }

    setLoading(true);
    setOutcome(null);
    try {
      const result = await verifyCredential(normalizedId, suppliedHash);
      setCertificateId(normalizedId);
      setOutcome({ kind: "result", verification: result.verification, hashSource: result.hashSource });
      setConnection("connected");

      const certificate = result.verification.certificate;
      if (certificate) {
        const verifiedAt = new Date().toISOString();
        const snapshot = snapshotFromVerification(result.verification, verifiedAt, result.hashSource);
        const nextWallet = upsertWalletCredential(wallet, certificate, result.documentHash, verifiedAt, snapshot);
        await persist(nextWallet, wallet);
        const updated = nextWallet.find((item) => credentialId(item) === credentialId(certificate));
        if (updated) onCredentialUpdated(updated);
      }
    } catch (error) {
      const apiError =
        error instanceof MobileApiError ? error : new MobileApiError("network", "No fue posible conectar con CertiChain.");
      setOutcome({ kind: apiError.code === "not_found" ? "not_found" : "error", message: apiError.message });
      if (["network", "timeout"].includes(apiError.code)) setConnection("offline");
    } finally {
      setLoading(false);
    }
  }

  return { certificateId, setCertificateId, outcome, setOutcome, loading, verify };
}
