import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { expoSecureStore } from "../lib/expoSecureStore";
import { clearWallet, loadWallet, saveWallet } from "../lib/secureWallet";
import type { WalletCredential } from "../types";

/** Local wallet backed by SecureStore (v2 layout, one entry per credential). */
export function useWallet() {
  const [wallet, setWallet] = useState<WalletCredential[]>([]);

  useEffect(() => {
    void loadWallet(expoSecureStore)
      .then(setWallet)
      .catch(() => setWallet([]));
  }, []);

  const stats = useMemo(
    () => ({
      total: wallet.length,
      active: wallet.filter((item) => item.status === "active").length,
      pending: wallet.filter((item) => item.status === "pending").length,
      revoked: wallet.filter((item) => item.status === "revoked").length,
    }),
    [wallet],
  );

  const persist = useCallback(async (next: WalletCredential[], previous: WalletCredential[]) => {
    setWallet(next);
    try {
      await saveWallet(expoSecureStore, next, previous);
    } catch {
      Alert.alert(
        "No se pudo guardar",
        "La verificación se completó, pero este dispositivo no pudo guardar la credencial de forma segura.",
      );
    }
  }, []);

  const clear = useCallback(async (current: WalletCredential[]) => {
    await clearWallet(expoSecureStore, current);
    setWallet([]);
  }, []);

  return { wallet, stats, persist, clear };
}
