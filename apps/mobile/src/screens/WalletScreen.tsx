import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BRAND_MARK } from "../assets";
import { Stat } from "../components/Common";
import { CredentialCard } from "../components/CredentialCard";
import { OutcomeCard } from "../components/OutcomeCard";
import type { Outcome } from "../hooks/useVerifier";
import { credentialId } from "../lib/wallet";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";
import type { WalletCredential } from "../types";

export function WalletScreen({
  wallet,
  stats,
  certificateId,
  onCertificateIdChange,
  outcome,
  loading,
  onVerify,
  onOpenCredential,
  onOpenScanner,
}: {
  wallet: WalletCredential[];
  stats: { total: number; active: number; pending: number; revoked: number };
  certificateId: string;
  onCertificateIdChange: (value: string) => void;
  outcome: Outcome | null;
  loading: boolean;
  onVerify: () => void;
  onOpenCredential: (credential: WalletCredential) => void;
  onOpenScanner: () => void;
}) {
  return (
    <View style={ui.section}>
      <View style={styles.hero}>
        <Text style={ui.eyebrow}>CERTICHAIN MOBILE WALLET</Text>
        <Text style={styles.heroTitle}>Credenciales verificables, claras y bajo tu control.</Text>
        <Text style={ui.body}>
          Valida por ID o escanea el QR. CertiChain consulta el registro institucional y, si existe, el ancla en blockchain.
        </Text>
      </View>
      <View style={styles.statsGrid}>
        <Stat value={stats.total} label="Guardadas" />
        <Stat value={stats.active} label="Vigentes" />
        <Stat value={stats.pending} label="Pendientes" />
        <Stat value={stats.revoked} label="Revocadas" />
      </View>
      <View style={ui.card}>
        <Text style={ui.cardEyebrow}>VERIFICACIÓN RÁPIDA</Text>
        <Text style={ui.cardTitle}>Verificar credencial</Text>
        <Text style={styles.inputLabel}>ID / Blockchain ID</Text>
        <TextInput
          value={certificateId}
          onChangeText={onCertificateIdChange}
          placeholder="Introduce el identificador"
          placeholderTextColor="#65749D"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          returnKeyType="go"
          onSubmitEditing={onVerify}
          accessibilityLabel="ID o Blockchain ID de la credencial"
        />
        <TouchableOpacity style={ui.primaryButton} onPress={onVerify} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator /> : <Text style={ui.primaryButtonText}>Verificar credencial</Text>}
        </TouchableOpacity>
      </View>
      {outcome ? <OutcomeCard outcome={outcome} onRetry={onVerify} /> : null}
      <View style={styles.sectionHeading}>
        <View style={ui.flexOne}>
          <Text style={styles.sectionTitle}>Mis credenciales</Text>
          <Text style={ui.meta}>Último estado conocido; revalida cuando necesites confirmación actual.</Text>
        </View>
        <TouchableOpacity style={styles.compactButton} onPress={onOpenScanner} accessibilityRole="button">
          <Text style={styles.compactButtonText}>Escanear QR</Text>
        </TouchableOpacity>
      </View>
      {wallet.length === 0 ? (
        <View style={styles.emptyState}>
          <Image source={BRAND_MARK} style={styles.emptyMark} resizeMode="contain" />
          <Text style={ui.cardTitle}>Wallet vacía</Text>
          <Text style={ui.bodyCentered}>Verifica una credencial para guardarla de forma segura en este dispositivo.</Text>
        </View>
      ) : (
        wallet.map((credential) => (
          <CredentialCard
            key={credentialId(credential)}
            credential={credential}
            mark={BRAND_MARK}
            onPress={() => onOpenCredential(credential)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 22, gap: 8 },
  heroTitle: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: "900", letterSpacing: -0.5 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: -3 },
  input: {
    minHeight: 48,
    backgroundColor: "#080F24",
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  compactButton: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  compactButtonText: { color: "#A78BFA", fontSize: 12, fontWeight: "900" },
  emptyState: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    gap: 8,
  },
  emptyMark: { width: 58, height: 58 },
});
