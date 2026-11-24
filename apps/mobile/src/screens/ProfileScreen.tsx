import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { APP_VERSION } from "../assets";
import { API_URL } from "../lib/api";
import { connectionLabel } from "../lib/format";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";
import type { ConnectionState } from "../types";

export function ProfileScreen({
  connection,
  blockchainConfigured,
  onRefreshConnection,
  onClearHistory,
}: {
  connection: ConnectionState;
  blockchainConfigured: boolean | null;
  onRefreshConnection: () => void;
  onClearHistory: () => void;
}) {
  return (
    <View style={ui.section}>
      <View style={ui.heroCompact}>
        <Text style={ui.eyebrow}>PERFIL Y AJUSTES</Text>
        <Text style={ui.detailTitle}>CertiChain Wallet</Text>
        <Text style={ui.body}>Versión {APP_VERSION}. Privacidad por diseño y almacenamiento local seguro.</Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.cardEyebrow}>PRIVACIDAD POR DISEÑO</Text>
        <Text style={ui.cardTitle}>Documentos sensibles fuera de blockchain pública</Text>
        <Text style={ui.body}>
          La app conserva la wallet local en Expo SecureStore. La blockchain recibe evidencia mínima; no el documento académico
          completo.
        </Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.cardEyebrow}>ENTORNO</Text>
        <Text style={ui.cardTitle}>{connectionLabel(connection)}</Text>
        {blockchainConfigured !== null ? (
          <Text style={ui.meta}>
            {blockchainConfigured
              ? "El servidor tiene la integración blockchain configurada."
              : "El servidor opera en modo off-chain (sin blockchain configurada)."}
          </Text>
        ) : null}
        <Text style={ui.mono} numberOfLines={3}>
          {API_URL || "EXPO_PUBLIC_API_URL no configurada"}
        </Text>
        <Text style={ui.meta}>
          En teléfono físico usa la IP LAN de tu PC. En Android Emulator usa 10.0.2.2. Producción futura debe usar HTTPS real.
        </Text>
        <TouchableOpacity style={ui.secondaryButton} onPress={onRefreshConnection} accessibilityRole="button">
          <Text style={ui.secondaryButtonText}>Comprobar conexión</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dangerButton} onPress={onClearHistory} accessibilityRole="button">
        <Text style={styles.dangerButtonText}>Eliminar historial local</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dangerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#2C111B",
    borderRadius: 13,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: { color: colors.redSoft, fontWeight: "900" },
});
