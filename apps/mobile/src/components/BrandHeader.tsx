import type { ImageSourcePropType } from "react-native";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import type { ConnectionState } from "../types";

const connectionCopy: Record<ConnectionState, string> = {
  checking: "Comprobando",
  connected: "Conectado",
  offline: "Sin conexión",
  unconfigured: "API sin configurar",
};

export function BrandHeader({
  logo,
  connection,
}: {
  logo: ImageSourcePropType;
  connection: ConnectionState;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandBlock}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="CertiChain" />
        <Text style={styles.tagline}>Verified. Immutable. Trusted.</Text>
      </View>
      <View
        style={[styles.connection, connection === "connected" ? styles.connected : styles.disconnected]}
        accessible
        accessibilityLabel={`Estado de conexión: ${connectionCopy[connection]}`}
      >
        <View style={[styles.dot, connection === "connected" ? styles.dotConnected : styles.dotDisconnected]} />
        <Text style={styles.connectionText}>{connectionCopy[connection]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  brandBlock: { flex: 1, minWidth: 0 },
  logo: { width: 154, height: 42 },
  tagline: { color: colors.textSubtle, fontSize: 9, letterSpacing: 0.7, marginTop: -2 },
  connection: {
    maxWidth: 126,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  connected: { backgroundColor: "#0B2B22", borderColor: "#135B43" },
  disconnected: { backgroundColor: colors.surfaceSoft, borderColor: colors.borderStrong },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotConnected: { backgroundColor: colors.green },
  dotDisconnected: { backgroundColor: colors.amber },
  connectionText: { flexShrink: 1, color: colors.textMuted, fontSize: 9, fontWeight: "800" },
});
