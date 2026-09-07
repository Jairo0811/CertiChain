import { StyleSheet, Text, View } from "react-native";
import { statusColor, statusDescription, statusLabel, statusTone } from "../lib/status";
import { colors } from "../theme/colors";
import type { CertificateStatus } from "../types";

export function StatusBadge({ status }: { status: CertificateStatus }) {
  const tone = statusTone(status);
  return (
    <View
      style={[
        styles.badge,
        tone === "success" ? styles.success : tone === "warning" ? styles.warning : styles.danger,
      ]}
      accessible
      accessibilityLabel={`${statusLabel(status)}. ${statusDescription(status)}`}
    >
      <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      <Text
        style={[
          styles.text,
          tone === "success" ? styles.successText : tone === "warning" ? styles.warningText : styles.dangerText,
        ]}
      >
        {statusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  text: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  success: { backgroundColor: "#0B2B22", borderColor: "#135B43" },
  warning: { backgroundColor: "#302815", borderColor: "#765F1B" },
  danger: { backgroundColor: "#32131D", borderColor: "#7F2638" },
  successText: { color: colors.greenSoft },
  warningText: { color: colors.amberSoft },
  dangerText: { color: colors.redSoft },
});
