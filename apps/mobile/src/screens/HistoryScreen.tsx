import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BRAND_MARK } from "../assets";
import { CenteredMessage } from "../components/Common";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import { credentialId } from "../lib/wallet";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";
import type { WalletCredential } from "../types";

export function HistoryScreen({
  wallet,
  onOpenCredential,
}: {
  wallet: WalletCredential[];
  onOpenCredential: (credential: WalletCredential) => void;
}) {
  return (
    <View style={ui.section}>
      <View style={ui.heroCompact}>
        <Text style={ui.eyebrow}>HISTORIAL LOCAL</Text>
        <Text style={ui.detailTitle}>Validaciones recientes</Text>
        <Text style={ui.body}>
          Ordenado por la última verificación. Una credencial guardada no se considera vigente para siempre.
        </Text>
      </View>
      {wallet.length === 0 ? (
        <CenteredMessage title="Sin historial" message="Aún no hay credenciales verificadas en este dispositivo." />
      ) : (
        wallet.map((credential) => (
          <TouchableOpacity
            key={credentialId(credential)}
            style={styles.row}
            onPress={() => onOpenCredential(credential)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir historial de ${credential.title}`}
          >
            <Image source={BRAND_MARK} style={styles.mark} resizeMode="contain" />
            <View style={ui.flexOne}>
              <Text style={styles.title} numberOfLines={2}>
                {credential.title}
              </Text>
              <Text style={ui.meta} numberOfLines={1}>
                {credential.institution}
              </Text>
              <Text style={styles.time}>Última verificación: {formatDate(credential.verifiedAt, true)}</Text>
            </View>
            <StatusBadge status={credential.status} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 12,
  },
  mark: { width: 38, height: 38 },
  title: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  time: { color: colors.textSubtle, fontSize: 9, marginTop: 3 },
});
