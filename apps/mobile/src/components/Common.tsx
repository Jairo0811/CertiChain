import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";

export function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={mono ? ui.mono : styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} accessibilityRole="button">
      <Text style={ui.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function CenteredMessage({ title, message }: { title: string; message: string }) {
  return (
    <View style={ui.centered}>
      <Text style={ui.cardTitle}>{title}</Text>
      <Text style={ui.bodyCentered}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 3 },
  detailLabel: { color: colors.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  detailValue: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  actionButton: {
    width: "48%",
    flexGrow: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stat: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: "700", marginTop: 2 },
});
