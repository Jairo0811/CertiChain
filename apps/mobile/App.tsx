import { useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

type Verification = {
  valid: boolean;
  certificate?: {
    id: string;
    blockchainId?: string;
    studentName: string;
    title: string;
    institution: string;
    issuedAt: string;
    status: string;
  };
  error?: string;
};

export default function App() {
  const [certificateId, setCertificateId] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(false);

  const statusLabel = useMemo(() => {
    if (!verification) return "Sin verificar";
    return verification.valid ? "Credencial válida" : "No verificada";
  }, [verification]);

  async function verify() {
    if (!certificateId.trim() || !documentHash.trim()) {
      Alert.alert("Datos incompletos", "Introduce el ID y el SHA-256 del certificado.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(certificateId.trim())}?hash=${encodeURIComponent(documentHash.trim())}`,
      );
      const body = (await response.json()) as Verification;
      setVerification(body);
    } catch {
      setVerification({ valid: false, error: "No fue posible conectar con CertiChain." });
    } finally {
      setLoading(false);
    }
  }

  async function copyCredential() {
    if (!verification?.certificate) return;
    const credential = verification.certificate;
    await Clipboard.setStringAsync(
      `${credential.title} · ${credential.institution}\nID: ${credential.blockchainId ?? credential.id}`,
    );
    Alert.alert("Copiado", "Los datos de la credencial fueron copiados.");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>CC</Text></View>
          <View><Text style={styles.brand}>CertiChain</Text><Text style={styles.subtitle}>Student Credential Wallet</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SECURE · VERIFIABLE · IMMUTABLE</Text>
          <Text style={styles.title}>Tus credenciales, protegidas por diseño.</Text>
          <Text style={styles.body}>Consulta y verifica certificados académicos sin exponer información sensible en una blockchain pública.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verificar certificado</Text>
          <TextInput
            value={certificateId}
            onChangeText={setCertificateId}
            placeholder="ID o Blockchain ID"
            placeholderTextColor="#7180a8"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={documentHash}
            onChangeText={setDocumentHash}
            placeholder="SHA-256 (0x + 64 hex)"
            placeholderTextColor="#7180a8"
            autoCapitalize="none"
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify()} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Verificando..." : "Verificar credencial"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, verification?.valid ? styles.validCard : verification ? styles.invalidCard : undefined]}>
          <Text style={styles.status}>{verification?.valid ? "✓" : verification ? "✕" : "◇"} {statusLabel}</Text>
          {verification?.certificate && (
            <>
              <Text style={styles.credentialTitle}>{verification.certificate.title}</Text>
              <Text style={styles.body}>{verification.certificate.institution}</Text>
              <Text style={styles.meta}>{verification.certificate.studentName}</Text>
              <Text style={styles.meta}>Emitido: {verification.certificate.issuedAt}</Text>
              <Text style={styles.mono}>{verification.certificate.blockchainId ?? verification.certificate.id}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void copyCredential()}>
                <Text style={styles.secondaryButtonText}>Copiar credencial</Text>
              </TouchableOpacity>
            </>
          )}
          {verification?.error && <Text style={styles.error}>{verification.error}</Text>}
        </View>

        <Text style={styles.footer}>CertiChain · Academic credential security</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070b1f" },
  container: { padding: 22, gap: 18 },
  brandRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  logo: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontWeight: "800", fontSize: 18 },
  brand: { color: "white", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#8fa0cc", fontSize: 12 },
  hero: { paddingVertical: 14, gap: 8 },
  eyebrow: { color: "#14b8a6", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: "white", fontSize: 32, lineHeight: 38, fontWeight: "800" },
  body: { color: "#aeb9d6", fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: "#101831", borderWidth: 1, borderColor: "#202d55", padding: 18, borderRadius: 22, gap: 12 },
  validCard: { borderColor: "#14b8a6" },
  invalidCard: { borderColor: "#ef4444" },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  input: { backgroundColor: "#0b1227", color: "white", borderWidth: 1, borderColor: "#283866", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  primaryButton: { backgroundColor: "#5b4cf0", padding: 15, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderColor: "#47598d", padding: 12, borderRadius: 12, alignItems: "center" },
  secondaryButtonText: { color: "#c6d1ff", fontWeight: "700" },
  status: { color: "#e5eaff", fontSize: 18, fontWeight: "800" },
  credentialTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  meta: { color: "#8fa0cc", fontSize: 13 },
  mono: { color: "#9d8cff", fontFamily: "monospace", fontSize: 12 },
  error: { color: "#fca5a5" },
  footer: { textAlign: "center", color: "#63739d", marginTop: 8, marginBottom: 24 },
});
