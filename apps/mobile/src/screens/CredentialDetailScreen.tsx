import * as Clipboard from "expo-clipboard";
import { Alert, Image, Linking, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { BRAND_MARK } from "../assets";
import { ActionButton, DetailRow } from "../components/Common";
import { StatusBadge } from "../components/StatusBadge";
import { VerificationChecks } from "../components/VerificationChecks";
import { PUBLIC_VERIFY_URL } from "../lib/api";
import { formatDate } from "../lib/format";
import { buildShareMessage, buildVerificationUrl } from "../lib/qr";
import { checkRows } from "../lib/snapshot";
import { statusDescription } from "../lib/status";
import { credentialId } from "../lib/wallet";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";
import type { WalletCredential } from "../types";

export function CredentialDetailScreen({
  credential,
  loading,
  onBack,
  onRevalidate,
}: {
  credential: WalletCredential;
  loading: boolean;
  onBack: () => void;
  onRevalidate: () => void;
}) {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(150, Math.min(190, width - 120));
  const url = buildVerificationUrl(PUBLIC_VERIFY_URL, credentialId(credential));
  const publicUrl = url.startsWith("http://") || url.startsWith("https://");

  async function share() {
    await Share.share({ message: buildShareMessage(credential.title, credential.institution, url) });
  }

  async function copyId() {
    await Clipboard.setStringAsync(credentialId(credential));
    Alert.alert("ID copiado", "El identificador de la credencial fue copiado.");
  }

  async function copyHash() {
    await Clipboard.setStringAsync(credential.documentHash);
    Alert.alert("SHA-256 copiado", "La evidencia de integridad fue copiada.");
  }

  return (
    <View style={ui.section}>
      <TouchableOpacity
        style={styles.textButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Volver a mis credenciales"
      >
        <Text style={styles.textButtonText}>Volver a mis credenciales</Text>
      </TouchableOpacity>
      <View style={styles.detailCard}>
        <View style={styles.detailHeader}>
          <Image source={BRAND_MARK} style={styles.detailMark} resizeMode="contain" />
          <StatusBadge status={credential.status} />
        </View>
        <Text style={ui.eyebrow}>CREDENCIAL ACADÉMICA</Text>
        <Text style={ui.detailTitle}>{credential.title}</Text>
        <Text style={styles.institution}>{credential.institution}</Text>
        <View style={styles.qrShell} accessible accessibilityLabel="Código QR de verificación pública de la credencial">
          <QRCode value={url} size={qrSize} backgroundColor={colors.white} color="#081126" />
        </View>
        <Text style={styles.qrCaption}>QR compatible con el verificador público actual</Text>
        <View style={styles.detailList}>
          <DetailRow label="Estudiante" value={credential.studentName} />
          <DetailRow label="Fecha de emisión" value={formatDate(credential.issuedAt)} />
          <DetailRow label="Estado actual" value={statusDescription(credential.status)} />
          <DetailRow label="ID / Blockchain ID" value={credentialId(credential)} mono />
          {credential.documentHash ? (
            <DetailRow label="SHA-256 registrado (referencia)" value={credential.documentHash} mono />
          ) : null}
          <DetailRow label="Última verificación" value={formatDate(credential.verifiedAt, true)} />
        </View>
        {credential.lastVerification ? (
          <VerificationChecks
            rows={checkRows(credential.lastVerification)}
            cachedAt={formatDate(credential.lastVerification.verifiedAt, true)}
          />
        ) : (
          <Text style={ui.meta}>
            No hay un resultado de verificación guardado para esta credencial. Valídala ahora para conocer su estado actual.
          </Text>
        )}
        <TouchableOpacity style={ui.primaryButton} onPress={onRevalidate} disabled={loading} accessibilityRole="button">
          <Text style={ui.primaryButtonText}>{loading ? "Validando…" : "Validar estado ahora"}</Text>
        </TouchableOpacity>
        <View style={styles.actionGrid}>
          <ActionButton label="Compartir credencial" onPress={() => void share()} />
          <ActionButton label="Copiar ID" onPress={() => void copyId()} />
          {credential.documentHash ? <ActionButton label="Copiar SHA-256" onPress={() => void copyHash()} /> : null}
          {publicUrl ? <ActionButton label="Comprobar PDF en el verificador" onPress={() => void Linking.openURL(url)} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textButton: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 6 },
  textButtonText: { color: "#B39CFF", fontWeight: "900" },
  detailCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    padding: 16,
    gap: 11,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailMark: { width: 50, height: 50 },
  institution: { color: "#C4B5FD", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  qrShell: { backgroundColor: colors.white, padding: 14, borderRadius: 18, alignSelf: "center", marginTop: 3 },
  qrCaption: { color: colors.textSubtle, fontSize: 10, textAlign: "center" },
  detailList: { borderTopWidth: 1, borderTopColor: colors.border },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
