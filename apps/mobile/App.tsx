import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import QRCode from "react-native-qrcode-svg";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const WALLET_KEY = "certichain-wallet-v1";

type Tab = "wallet" | "scan" | "history" | "profile";

type Certificate = {
  id: string;
  blockchainId?: string;
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  status: string;
};

type Verification = {
  valid: boolean;
  certificate?: Certificate;
  error?: string;
};

type WalletCredential = Certificate & {
  documentHash: string;
  verifiedAt: string;
};

function credentialId(certificate: Certificate) {
  return certificate.blockchainId ?? certificate.id;
}

function verificationUrl(credential: WalletCredential) {
  return `certichain://verify?id=${encodeURIComponent(credentialId(credential))}&hash=${encodeURIComponent(credential.documentHash)}`;
}

function parseQr(data: string) {
  try {
    const url = new URL(data);
    const id = url.searchParams.get("id") ?? "";
    const hash = url.searchParams.get("hash") ?? "";
    return { id, hash };
  } catch {
    return { id: data.trim(), hash: "" };
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("wallet");
  const [certificateId, setCertificateId] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [wallet, setWallet] = useState<WalletCredential[]>([]);
  const [selected, setSelected] = useState<WalletCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const statusLabel = useMemo(() => {
    if (!verification) return "Sin verificar";
    return verification.valid ? "Credencial válida" : "No verificada";
  }, [verification]);

  useEffect(() => {
    void SecureStore.getItemAsync(WALLET_KEY).then((value) => {
      if (!value) return;
      try {
        setWallet(JSON.parse(value) as WalletCredential[]);
      } catch {
        setWallet([]);
      }
    });
  }, []);

  async function persistWallet(next: WalletCredential[]) {
    setWallet(next);
    await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(next));
  }

  async function verify(id = certificateId, hash = documentHash) {
    if (!id.trim() || !hash.trim()) {
      Alert.alert("Datos incompletos", "Introduce el ID y el SHA-256 del certificado.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(id.trim())}?hash=${encodeURIComponent(hash.trim())}`,
      );
      const body = (await response.json()) as Verification;
      setVerification(body);
      setCertificateId(id.trim());
      setDocumentHash(hash.trim());

      if (body.valid && body.certificate) {
        const credential: WalletCredential = {
          ...body.certificate,
          documentHash: hash.trim(),
          verifiedAt: new Date().toISOString(),
        };
        const next = [credential, ...wallet.filter((item) => credentialId(item) !== credentialId(credential))].slice(0, 20);
        await persistWallet(next);
        setSelected(credential);
      }
    } catch {
      setVerification({ valid: false, error: "No fue posible conectar con CertiChain." });
    } finally {
      setLoading(false);
    }
  }

  async function copyCredential(credential: WalletCredential) {
    await Clipboard.setStringAsync(`${credential.title} · ${credential.institution}\nID: ${credentialId(credential)}`);
    Alert.alert("Copiado", "Los datos de la credencial fueron copiados.");
  }

  async function shareCredential(credential: WalletCredential) {
    await Share.share({
      message: `${credential.title} · ${credential.institution}\n${verificationUrl(credential)}`,
    });
  }

  async function clearHistory() {
    await persistWallet([]);
    setSelected(null);
    setVerification(null);
    Alert.alert("Historial eliminado", "Las credenciales guardadas localmente fueron eliminadas.");
  }

  async function handleScanned(data: string) {
    if (scanned) return;
    setScanned(true);
    const parsed = parseQr(data);
    if (!parsed.id || !parsed.hash) {
      Alert.alert("QR no compatible", "El código no contiene un ID y hash de CertiChain.");
      return;
    }
    setTab("wallet");
    await verify(parsed.id, parsed.hash);
  }

  function renderCredentialCard(credential: WalletCredential) {
    return (
      <TouchableOpacity key={credentialId(credential)} style={styles.credentialCard} onPress={() => setSelected(credential)}>
        <View style={styles.credentialHeader}>
          <View style={styles.miniLogo}><Text style={styles.miniLogoText}>CC</Text></View>
          <Text style={credential.status === "revoked" ? styles.revokedBadge : styles.validBadge}>
            {credential.status === "revoked" ? "REVOCADO" : "VIGENTE"}
          </Text>
        </View>
        <Text style={styles.credentialTitle}>{credential.title}</Text>
        <Text style={styles.body}>{credential.institution}</Text>
        <Text style={styles.meta}>{credential.studentName}</Text>
        <Text style={styles.meta}>Emitido: {credential.issuedAt}</Text>
        <View style={styles.qrPreview}>
          <QRCode value={verificationUrl(credential)} size={116} backgroundColor="#ffffff" color="#111827" />
        </View>
        <Text style={styles.mono} numberOfLines={1}>{credentialId(credential)}</Text>
      </TouchableOpacity>
    );
  }

  function renderWallet() {
    if (selected) {
      return (
        <View style={styles.screenSection}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelected(null)}><Text style={styles.backButtonText}>‹ Mis credenciales</Text></TouchableOpacity>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>DETALLE DE CREDENCIAL</Text>
            <Text style={styles.credentialTitleLarge}>{selected.title}</Text>
            <Text style={styles.body}>{selected.institution}</Text>
            <View style={styles.qrLarge}><QRCode value={verificationUrl(selected)} size={190} backgroundColor="#ffffff" color="#111827" /></View>
            <View style={styles.detailList}>
              <View><Text style={styles.detailLabel}>Otorgado a</Text><Text style={styles.detailValue}>{selected.studentName}</Text></View>
              <View><Text style={styles.detailLabel}>Fecha de emisión</Text><Text style={styles.detailValue}>{selected.issuedAt}</Text></View>
              <View><Text style={styles.detailLabel}>Estado</Text><Text style={selected.status === "revoked" ? styles.revokedText : styles.validText}>{selected.status}</Text></View>
              <View><Text style={styles.detailLabel}>ID en blockchain</Text><Text style={styles.mono}>{credentialId(selected)}</Text></View>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => void shareCredential(selected)}><Text style={styles.primaryButtonText}>Compartir credencial</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void copyCredential(selected)}><Text style={styles.secondaryButtonText}>Copiar ID</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.screenSection}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MIS CREDENCIALES</Text>
          <Text style={styles.title}>Tus certificados verificados, siempre a mano.</Text>
          <Text style={styles.body}>Cada verificación válida se guarda de forma segura en el dispositivo para consultarla y compartirla.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agregar / verificar certificado</Text>
          <TextInput value={certificateId} onChangeText={setCertificateId} placeholder="ID o Blockchain ID" placeholderTextColor="#7180a8" autoCapitalize="none" style={styles.input} />
          <TextInput value={documentHash} onChangeText={setDocumentHash} placeholder="SHA-256 (0x + 64 hex)" placeholderTextColor="#7180a8" autoCapitalize="none" style={styles.input} />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify()} disabled={loading}><Text style={styles.primaryButtonText}>{loading ? "Verificando..." : "Verificar credencial"}</Text></TouchableOpacity>
          <Text style={verification?.valid ? styles.validText : verification ? styles.revokedText : styles.meta}>◇ {statusLabel}</Text>
          {verification?.error && <Text style={styles.error}>{verification.error}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Credenciales guardadas</Text>
        {wallet.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.cardTitle}>Aún no tienes credenciales</Text><Text style={styles.body}>Verifica un certificado manualmente o escanea su QR.</Text></View> : wallet.map(renderCredentialCard)}
      </View>
    );
  }

  function renderScanner() {
    if (!permission) return <View style={styles.centered}><Text style={styles.body}>Solicitando permiso de cámara…</Text></View>;
    if (!permission.granted) {
      return <View style={styles.centered}><Text style={styles.titleSmall}>Escáner QR</Text><Text style={styles.body}>CertiChain necesita acceso a la cámara para verificar códigos QR.</Text><TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()}><Text style={styles.primaryButtonText}>Permitir cámara</Text></TouchableOpacity></View>;
    }

    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}><Text style={styles.eyebrow}>VERIFICACIÓN MÓVIL</Text><Text style={styles.titleSmall}>Escanear QR</Text><Text style={styles.body}>Apunta la cámara al código QR de una credencial CertiChain.</Text></View>
        <View style={styles.cameraFrame}>
          <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : ({ data }) => void handleScanned(data)} />
          <View pointerEvents="none" style={styles.scanOverlay}><View style={styles.scanBox} /></View>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanned(false)}><Text style={styles.secondaryButtonText}>{scanned ? "Escanear otro código" : "Escáner listo"}</Text></TouchableOpacity>
      </View>
    );
  }

  function renderHistory() {
    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}><Text style={styles.eyebrow}>HISTORIAL</Text><Text style={styles.titleSmall}>Verificaciones recientes</Text><Text style={styles.body}>Historial local de credenciales verificadas en este dispositivo.</Text></View>
        {wallet.length === 0 ? <View style={styles.emptyState}><Text style={styles.body}>No hay verificaciones guardadas.</Text></View> : wallet.map((credential) => <TouchableOpacity key={credentialId(credential)} style={styles.historyRow} onPress={() => { setSelected(credential); setTab("wallet"); }}><View><Text style={styles.historyTitle}>{credential.title}</Text><Text style={styles.meta}>{credential.institution}</Text><Text style={styles.meta}>{new Date(credential.verifiedAt).toLocaleString()}</Text></View><Text style={credential.status === "revoked" ? styles.revokedText : styles.validText}>{credential.status}</Text></TouchableOpacity>)}
      </View>
    );
  }

  function renderProfile() {
    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}><Text style={styles.eyebrow}>PERFIL</Text><Text style={styles.titleSmall}>CertiChain Wallet</Text><Text style={styles.body}>Aplicación estudiantil para consultar, verificar y compartir credenciales académicas.</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Privacidad por diseño</Text><Text style={styles.body}>El historial mostrado aquí se guarda localmente en SecureStore. Los documentos sensibles no se almacenan en una blockchain pública.</Text><TouchableOpacity style={styles.dangerButton} onPress={() => void clearHistory()}><Text style={styles.dangerButtonText}>Eliminar historial local</Text></TouchableOpacity></View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.app}>
        <View style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>CC</Text></View><View><Text style={styles.brand}>CertiChain</Text><Text style={styles.subtitle}>Verified. Immutable. Trusted.</Text></View></View>
        <ScrollView contentContainerStyle={styles.container}>{tab === "wallet" ? renderWallet() : tab === "scan" ? renderScanner() : tab === "history" ? renderHistory() : renderProfile()}</ScrollView>
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => { setTab("wallet"); setSelected(null); }}><Text style={tab === "wallet" ? styles.tabIconActive : styles.tabIcon}>⌂</Text><Text style={tab === "wallet" ? styles.tabTextActive : styles.tabText}>Inicio</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => { setTab("scan"); setScanned(false); }}><Text style={tab === "scan" ? styles.tabIconActive : styles.tabIcon}>⌗</Text><Text style={tab === "scan" ? styles.tabTextActive : styles.tabText}>Escanear</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => setTab("history")}><Text style={tab === "history" ? styles.tabIconActive : styles.tabIcon}>◷</Text><Text style={tab === "history" ? styles.tabTextActive : styles.tabText}>Historial</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => setTab("profile")}><Text style={tab === "profile" ? styles.tabIconActive : styles.tabIcon}>◎</Text><Text style={tab === "profile" ? styles.tabTextActive : styles.tabText}>Perfil</Text></TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050817" },
  app: { flex: 1, backgroundColor: "#070b1f" },
  container: { paddingHorizontal: 18, paddingBottom: 110 },
  brandRow: { flexDirection: "row", gap: 11, alignItems: "center", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#111a35" },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontWeight: "900", fontSize: 16 },
  miniLogo: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  miniLogoText: { color: "white", fontWeight: "900", fontSize: 12 },
  brand: { color: "white", fontSize: 21, fontWeight: "800" },
  subtitle: { color: "#7180a8", fontSize: 10 },
  screenSection: { gap: 16 },
  hero: { paddingTop: 24, gap: 8 },
  heroCompact: { paddingTop: 24, gap: 7 },
  eyebrow: { color: "#22d3ee", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "white", fontSize: 30, lineHeight: 36, fontWeight: "800" },
  titleSmall: { color: "white", fontSize: 26, lineHeight: 32, fontWeight: "800" },
  body: { color: "#aeb9d6", fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: "#101831", borderWidth: 1, borderColor: "#202d55", padding: 18, borderRadius: 22, gap: 12 },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  input: { backgroundColor: "#0b1227", color: "white", borderWidth: 1, borderColor: "#283866", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  primaryButton: { backgroundColor: "#5b4cf0", padding: 15, borderRadius: 14, alignItems: "center" },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderColor: "#47598d", padding: 12, borderRadius: 12, alignItems: "center" },
  secondaryButtonText: { color: "#c6d1ff", fontWeight: "700" },
  dangerButton: { borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#31111a", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 8 },
  dangerButtonText: { color: "#fca5a5", fontWeight: "800" },
  validText: { color: "#4ade80", fontWeight: "800" },
  revokedText: { color: "#f87171", fontWeight: "800" },
  error: { color: "#fca5a5" },
  meta: { color: "#8fa0cc", fontSize: 12 },
  mono: { color: "#a78bfa", fontFamily: "monospace", fontSize: 11 },
  sectionTitle: { color: "white", fontSize: 18, fontWeight: "800", marginTop: 2 },
  credentialCard: { backgroundColor: "#111a38", borderWidth: 1, borderColor: "#2b3768", padding: 17, borderRadius: 22, gap: 10 },
  credentialHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  credentialTitle: { color: "white", fontSize: 22, fontWeight: "800" },
  credentialTitleLarge: { color: "white", fontSize: 27, fontWeight: "800" },
  validBadge: { color: "#4ade80", fontSize: 10, fontWeight: "900", backgroundColor: "#0d2a21", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  revokedBadge: { color: "#f87171", fontSize: 10, fontWeight: "900", backgroundColor: "#33151c", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  qrPreview: { backgroundColor: "white", padding: 10, borderRadius: 16, alignSelf: "center", marginVertical: 4 },
  qrLarge: { backgroundColor: "white", padding: 16, borderRadius: 20, alignSelf: "center", marginVertical: 8 },
  detailList: { gap: 13, paddingVertical: 4 },
  detailLabel: { color: "#7180a8", fontSize: 11, marginBottom: 3 },
  detailValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "700" },
  backButton: { alignSelf: "flex-start", marginTop: 16, paddingVertical: 8, paddingHorizontal: 0, backgroundColor: "transparent" },
  backButtonText: { color: "#a78bfa", fontWeight: "800" },
  emptyState: { backgroundColor: "#0e1630", borderWidth: 1, borderColor: "#202d55", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  emptyIcon: { color: "#8b5cf6", fontSize: 36 },
  cameraFrame: { height: 430, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#33406e", position: "relative" },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanBox: { width: 230, height: 230, borderWidth: 3, borderColor: "#67e8f9", borderRadius: 24, backgroundColor: "transparent" },
  centered: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  historyRow: { backgroundColor: "#101831", borderWidth: 1, borderColor: "#202d55", padding: 16, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyTitle: { color: "white", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: "#080d1f", borderTopWidth: 1, borderTopColor: "#202d55", paddingTop: 9, paddingBottom: 12, paddingHorizontal: 6 },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { color: "#64748b", fontSize: 21 },
  tabIconActive: { color: "#8b5cf6", fontSize: 21 },
  tabText: { color: "#64748b", fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: "#c4b5fd", fontSize: 10, fontWeight: "800" },
});
