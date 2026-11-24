import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BRAND_MARK } from "../assets";
import { CenteredMessage } from "../components/Common";
import { parseCredentialReference } from "../lib/qr";
import { colors } from "../theme/colors";
import { ui } from "../theme/ui";

const IDLE_MESSAGE = "Alinea el QR dentro del marco";

/**
 * QR scanner. Its state lives here and resets every time the tab is opened (the screen remounts).
 * Supports current QR links, legacy deep links with a hash and bare CertiChain identifiers.
 */
export function ScannerScreen({ onCredentialScanned }: { onCredentialScanned: (id: string, hash?: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState(IDLE_MESSAGE);

  function handleScanned(data: string) {
    if (scanned) return;
    setScanned(true);
    setMessage("QR detectado. Verificando credencial…");
    const reference = parseCredentialReference(data);
    if (!reference.id) {
      setMessage("QR inválido o no compatible con CertiChain.");
      return;
    }
    onCredentialScanned(reference.id, reference.hash);
  }

  function reset() {
    setScanned(false);
    setMessage(IDLE_MESSAGE);
  }

  if (!permission) {
    return <CenteredMessage title="Preparando la cámara" message="CertiChain está comprobando el permiso de cámara." />;
  }

  if (!permission.granted) {
    return (
      <View style={ui.centered}>
        <Image source={BRAND_MARK} style={styles.permissionMark} resizeMode="contain" />
        <Text style={ui.detailTitle}>Permiso de cámara</Text>
        <Text style={ui.bodyCentered}>
          La cámara se usa únicamente para leer códigos QR de credenciales. CertiChain no necesita grabar audio.
        </Text>
        <TouchableOpacity style={styles.primaryButtonWide} onPress={() => void requestPermission()} accessibilityRole="button">
          <Text style={ui.primaryButtonText}>Permitir cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={ui.section}>
      <View style={ui.heroCompact}>
        <Text style={ui.eyebrow}>ESCÁNER QR</Text>
        <Text style={ui.detailTitle}>Escanear credencial</Text>
        <Text style={ui.body}>Compatible con QR moderno, deep link legacy con hash e identificadores de CertiChain.</Text>
      </View>
      <View style={styles.cameraFrame}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => handleScanned(data)}
        />
        <View pointerEvents="none" style={styles.scanOverlay}>
          <View style={styles.scanBox} />
          <Text style={styles.scanHint}>{message}</Text>
        </View>
      </View>
      <TouchableOpacity style={ui.secondaryButton} onPress={reset} accessibilityRole="button">
        <Text style={ui.secondaryButtonText}>{scanned ? "Escanear otro código" : "Reiniciar escáner"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionMark: { width: 72, height: 72 },
  primaryButtonWide: {
    width: "100%",
    maxWidth: 340,
    minHeight: 48,
    backgroundColor: colors.indigo,
    borderRadius: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFrame: {
    height: 420,
    maxHeight: 520,
    minHeight: 320,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "#020617",
  },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 28 },
  scanBox: {
    width: "78%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.cyan,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  scanHint: {
    marginTop: 18,
    color: colors.white,
    backgroundColor: "rgba(5,8,23,0.88)",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
});
