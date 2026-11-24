import { StyleSheet } from "react-native";
import { colors } from "./colors";

/** Styles shared by several screens. Screen-specific styles live next to each screen. */
export const ui = StyleSheet.create({
  section: { gap: 14 },
  heroCompact: { paddingTop: 20, gap: 7 },
  eyebrow: { color: colors.cyan, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  detailTitle: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900" },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  bodyCentered: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  meta: { color: colors.textSubtle, fontSize: 11, lineHeight: 16 },
  mono: { color: "#B7A7FF", fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  flexOne: { flex: 1 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardEyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  cardTitle: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  primaryButton: {
    minHeight: 48,
    backgroundColor: colors.indigo,
    borderRadius: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#C7D2FE", fontSize: 12, fontWeight: "800", textAlign: "center" },
  centered: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22 },
});
