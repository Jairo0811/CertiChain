import { StyleSheet, Text, View } from "react-native";
import type { CheckRow, CheckTone } from "../lib/snapshot";
import { colors } from "../theme/colors";

const TONE_COLOR: Record<CheckTone, string> = {
  ok: colors.green,
  fail: colors.red,
  warn: colors.amber,
  skip: colors.textSubtle,
};

/**
 * Renders verification check rows. When `cachedAt` is set the block is explicitly labelled as a
 * stored result, so cached data is never presented as a fresh verification.
 */
export function VerificationChecks({ rows, cachedAt }: { rows: CheckRow[]; cachedAt?: string }) {
  return (
    <View style={styles.list} accessibilityRole="summary">
      {cachedAt ? (
        <Text style={styles.cached}>Resultado guardado de la verificación del {cachedAt}. No es una comprobación actual.</Text>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.label}
          style={styles.row}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}`}
        >
          <View style={[styles.dot, { backgroundColor: TONE_COLOR[row.tone] }, row.tone === "skip" && styles.dotHollow]} />
          <View style={styles.text}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingTop: 4 },
  cached: { color: colors.amberSoft, fontSize: 11, lineHeight: 16 },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#081126",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 99 },
  dotHollow: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.textSubtle },
  text: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  value: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
