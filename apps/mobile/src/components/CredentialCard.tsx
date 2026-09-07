import type { ImageSourcePropType } from "react-native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { credentialId } from "../lib/wallet";
import { colors } from "../theme/colors";
import type { WalletCredential } from "../types";
import { StatusBadge } from "./StatusBadge";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function truncateId(id: string) {
  return id.length > 24 ? `${id.slice(0, 11)}…${id.slice(-9)}` : id;
}

export function CredentialCard({
  credential,
  mark,
  onPress,
}: {
  credential: WalletCredential;
  mark: ImageSourcePropType;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.86}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir credencial ${credential.title}, ${credential.institution}`}
    >
      <View style={styles.header}>
        <View style={styles.markShell}>
          <Image source={mark} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
        <StatusBadge status={credential.status} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{credential.title}</Text>
      <Text style={styles.institution} numberOfLines={2}>{credential.institution}</Text>
      <Text style={styles.student} numberOfLines={1}>{credential.studentName}</Text>
      <View style={styles.footer}>
        <View style={styles.metaBlock}>
          <Text style={styles.label}>EMITIDO</Text>
          <Text style={styles.value}>{formatDate(credential.issuedAt)}</Text>
        </View>
        <View style={styles.metaBlockRight}>
          <View style={styles.integrityRow}>
            <View style={styles.integrityDot} />
            <Text style={styles.integrityText}>SHA-256</Text>
          </View>
          <Text style={styles.id}>{truncateId(credentialId(credential))}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 18,
    gap: 7,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  markShell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { width: 31, height: 31 },
  title: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  institution: { color: "#C4B5FD", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  student: { color: colors.textMuted, fontSize: 12 },
  footer: {
    marginTop: 4,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  metaBlock: { flex: 1, gap: 2 },
  metaBlockRight: { flex: 1, gap: 3, alignItems: "flex-end" },
  label: { color: colors.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  value: { color: colors.text, fontSize: 11, fontWeight: "700" },
  integrityRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  integrityDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: colors.green },
  integrityText: { color: colors.greenSoft, fontSize: 9, fontWeight: "800" },
  id: { maxWidth: "100%", color: "#B7A7FF", fontFamily: "monospace", fontSize: 9 },
});
