import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Outcome } from "../hooks/useVerifier";
import { checkRows, outcomeOf, outcomeTitle as verificationTitle, outcomeTone, snapshotFromVerification } from "../lib/snapshot";
import { statusDescription } from "../lib/status";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";
import { StatusBadge } from "./StatusBadge";
import { VerificationChecks } from "./VerificationChecks";

function outcomeTitle(outcome: Outcome) {
  if (outcome.verification) return verificationTitle(outcomeOf(outcome.verification));
  if (outcome.kind === "not_found") return "Credencial no encontrada";
  return "No fue posible verificar";
}

/** Result of the verification that just ran (fresh data, never cached). */
export function OutcomeCard({ outcome, onRetry }: { outcome: Outcome; onRetry: () => void }) {
  const certificate = outcome.verification?.certificate;
  const tone = outcome.verification ? outcomeTone(outcomeOf(outcome.verification)) : "danger";
  const snapshot = outcome.verification
    ? snapshotFromVerification(outcome.verification, new Date().toISOString(), outcome.hashSource ?? "none")
    : undefined;

  return (
    <View
      style={[styles.card, tone === "success" ? styles.success : tone === "warning" ? styles.warning : styles.danger]}
      accessible
      accessibilityLiveRegion="polite"
    >
      <Text style={ui.eyebrow}>RESULTADO</Text>
      <Text style={styles.title}>{outcomeTitle(outcome)}</Text>
      {certificate ? <StatusBadge status={certificate.status} /> : null}
      {certificate ? (
        <Text style={ui.body}>
          {certificate.title}, {certificate.institution}
        </Text>
      ) : null}
      {certificate?.status ? <Text style={ui.meta}>{statusDescription(certificate.status)}</Text> : null}
      {snapshot ? <VerificationChecks rows={checkRows(snapshot)} /> : null}
      {outcome.message ? <Text style={styles.errorText}>{outcome.message}</Text> : null}
      {outcome.kind === "error" ? (
        <TouchableOpacity style={ui.secondaryButton} onPress={onRetry} accessibilityRole="button">
          <Text style={ui.secondaryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  success: { backgroundColor: "#0A211D", borderColor: "#145C49" },
  warning: { backgroundColor: "#2B2414", borderColor: "#765F1B" },
  danger: { backgroundColor: "#24131D", borderColor: "#6F283D" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  errorText: { color: colors.redSoft, fontSize: 13, lineHeight: 19 },
});
