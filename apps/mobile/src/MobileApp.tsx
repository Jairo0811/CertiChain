import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet } from "react-native";
import { BRAND_LOGO } from "./assets";
import { BrandHeader } from "./components/BrandHeader";
import { type Tab, TabBar } from "./components/TabBar";
import { useConnection } from "./hooks/useConnection";
import { useVerifier } from "./hooks/useVerifier";
import { useWallet } from "./hooks/useWallet";
import { credentialId } from "./lib/wallet";
import { CredentialDetailScreen } from "./screens/CredentialDetailScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ScannerScreen } from "./screens/ScannerScreen";
import { WalletScreen } from "./screens/WalletScreen";
import { colors } from "./theme/colors";
import type { WalletCredential } from "./types";

/**
 * App shell: tab navigation and coordination between screens. Wallet storage, API connection
 * and the verification flow live in hooks; each tab is a screen under src/screens.
 */
export default function MobileApp() {
  const [tab, setTab] = useState<Tab>("wallet");
  const [selected, setSelected] = useState<WalletCredential | null>(null);
  // Bumped whenever the scanner is opened so it starts fresh (as tapping "Escanear" always did).
  const [scannerSession, setScannerSession] = useState(0);
  const { wallet, stats, persist, clear } = useWallet();
  const { connection, setConnection, blockchainConfigured, refresh } = useConnection();
  const verifier = useVerifier({
    wallet,
    persist,
    setConnection,
    // Keep an open detail view in sync with the credential that was just re-verified.
    onCredentialUpdated: (updated) =>
      setSelected((current) => (current && credentialId(current) === credentialId(updated) ? updated : current)),
  });

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "wallet") setSelected(null);
    if (next === "scan") setScannerSession((value) => value + 1);
  }

  function openCredential(credential: WalletCredential) {
    setSelected(credential);
    setTab("wallet");
  }

  function handleScanned(id: string, hash?: string) {
    setTab("wallet");
    setSelected(null);
    void verifier.verify(id, hash);
  }

  function confirmClearHistory() {
    Alert.alert(
      "Eliminar historial local",
      "Se eliminarán de este dispositivo las credenciales e historial guardados. Esto NO elimina, revoca ni modifica el certificado real.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void clear(wallet).then(() => {
              setSelected(null);
              verifier.setOutcome(null);
            });
          },
        },
      ],
    );
  }

  function renderScreen() {
    if (tab === "scan") return <ScannerScreen key={scannerSession} onCredentialScanned={handleScanned} />;
    if (tab === "history") return <HistoryScreen wallet={wallet} onOpenCredential={openCredential} />;
    if (tab === "profile") {
      return (
        <ProfileScreen
          connection={connection}
          blockchainConfigured={blockchainConfigured}
          onRefreshConnection={() => void refresh()}
          onClearHistory={confirmClearHistory}
        />
      );
    }
    if (selected) {
      return (
        <CredentialDetailScreen
          credential={selected}
          loading={verifier.loading}
          onBack={() => setSelected(null)}
          onRevalidate={() => void verifier.verify(credentialId(selected))}
        />
      );
    }
    return (
      <WalletScreen
        wallet={wallet}
        stats={stats}
        certificateId={verifier.certificateId}
        onCertificateIdChange={verifier.setCertificateId}
        outcome={verifier.outcome}
        loading={verifier.loading}
        onVerify={() => void verifier.verify()}
        onOpenCredential={setSelected}
        onOpenScanner={() => selectTab("scan")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BrandHeader logo={BRAND_LOGO} connection={connection} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderScreen()}
        </ScrollView>
        <TabBar current={tab} onSelect={selectTab} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 28 },
});
