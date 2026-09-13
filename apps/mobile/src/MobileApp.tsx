import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BrandHeader } from "./components/BrandHeader";
import { CredentialCard } from "./components/CredentialCard";
import { StatusBadge } from "./components/StatusBadge";
import { API_URL, MobileApiError, PUBLIC_VERIFY_URL, checkApiConnection, verifyCredential } from "./lib/api";
import { buildShareMessage, buildVerificationUrl, parseCredentialReference } from "./lib/qr";
import { statusDescription, verificationVerdict } from "./lib/status";
import { WALLET_KEY, credentialId, normalizeWallet, upsertWalletCredential } from "./lib/wallet";
import { colors } from "./theme/colors";
import type { ConnectionState, Verification, WalletCredential } from "./types";

declare const require: (path: string) => number;

const BRAND_LOGO = require("../assets/branding/certichain-logo.png");
const BRAND_MARK = require("../assets/branding/certichain-isotipo.png");
const APP_VERSION = "1.0.0";

type Tab = "wallet" | "scan" | "history" | "profile";
type TabIconName = "home" | "scan" | "history" | "profile";
type OutcomeKind = "valid" | "pending" | "revoked" | "not_verified" | "not_found" | "error";

type Outcome = {
  kind: OutcomeKind;
  verification?: Verification;
  documentHash?: string;
  message?: string;
};

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function shortHash(hash: string) {
  return hash.length > 32 ? `${hash.slice(0, 16)}…${hash.slice(-12)}` : hash;
}

function outcomeFromVerification(verification: Verification): OutcomeKind {
  if (verification.certificate?.status === "revoked") return "revoked";
  if (verification.certificate?.status === "pending") return "pending";
  if (verification.valid && verification.certificate?.status === "active") return "valid";
  return "not_verified";
}

function outcomeTitle(outcome: Outcome) {
  if (outcome.verification) {
    return verificationVerdict(outcome.verification.valid, outcome.verification.certificate?.status);
  }
  if (outcome.kind === "not_found") return "Credencial no encontrada";
  if (outcome.kind === "error") return "No fue posible verificar";
  return "Credencial no verificada";
}

function connectionLabel(state: ConnectionState) {
  if (state === "connected") return "Conectado";
  if (state === "checking") return "Comprobando";
  if (state === "unconfigured") return "Sin configurar";
  return "Sin conexión";
}

function NavIcon({ name, active }: { name: TabIconName; active: boolean }) {
  const stroke = active ? "#C4B5FD" : "#64748B";
  const common = { stroke, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === "home" && <Path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" {...common} />}
      {name === "scan" && <><Path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" {...common} /><Rect x="9" y="9" width="6" height="6" rx="1.5" {...common} /></>}
      {name === "history" && <><Circle cx="12" cy="12" r="8" {...common} /><Path d="M12 7.5V12l3 2" {...common} /></>}
      {name === "profile" && <><Circle cx="12" cy="8" r="3.2" {...common} /><Path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6" {...common} /></>}
    </Svg>
  );
}

export default function MobileApp() {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(150, Math.min(190, width - 120));
  const [tab, setTab] = useState<Tab>("wallet");
  const [certificateId, setCertificateId] = useState("");
  const [wallet, setWallet] = useState<WalletCredential[]>([]);
  const [selected, setSelected] = useState<WalletCredential | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanMessage, setScanMessage] = useState("Alinea el QR dentro del marco");
  const [connection, setConnection] = useState<ConnectionState>(API_URL ? "checking" : "unconfigured");
  const [blockchainConfigured, setBlockchainConfigured] = useState<boolean | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const stats = useMemo(
    () => ({
      total: wallet.length,
      active: wallet.filter((item) => item.status === "active").length,
      pending: wallet.filter((item) => item.status === "pending").length,
      revoked: wallet.filter((item) => item.status === "revoked").length,
    }),
    [wallet],
  );

  useEffect(() => {
    void SecureStore.getItemAsync(WALLET_KEY).then((value) => {
      if (!value) return;
      try {
        setWallet(normalizeWallet(JSON.parse(value) as unknown));
      } catch {
        setWallet([]);
      }
    });
    void refreshConnection();
  }, []);

  async function refreshConnection() {
    setConnection(API_URL ? "checking" : "unconfigured");
    const result = await checkApiConnection();
    setConnection(result.state);
    setBlockchainConfigured(result.blockchainConfigured);
  }

  async function persistWallet(next: WalletCredential[]) {
    setWallet(next);
    await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(next));
  }

  async function verify(id = certificateId, suppliedHash?: string) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      setOutcome({ kind: "error", message: "Introduce el ID o Blockchain ID de la credencial." });
      return;
    }

    setLoading(true);
    setOutcome(null);
    try {
      const result = await verifyCredential(normalizedId, suppliedHash);
      const nextOutcome: Outcome = {
        kind: outcomeFromVerification(result.verification),
        verification: result.verification,
        documentHash: result.documentHash,
      };
      setCertificateId(normalizedId);
      setOutcome(nextOutcome);
      setConnection("connected");

      if (result.verification.certificate) {
        const verifiedAt = new Date().toISOString();
        const nextWallet = upsertWalletCredential(wallet, result.verification.certificate, result.documentHash, verifiedAt);
        await persistWallet(nextWallet);
        const updated = nextWallet.find((item) => credentialId(item) === credentialId(result.verification.certificate!));
        setSelected((current) => current && updated && credentialId(current) === credentialId(updated) ? updated : current);
      }
    } catch (error) {
      const apiError = error instanceof MobileApiError ? error : new MobileApiError("network", "No fue posible conectar con CertiChain.");
      setOutcome({ kind: apiError.code === "not_found" ? "not_found" : "error", message: apiError.message });
      if (["network", "timeout"].includes(apiError.code)) setConnection("offline");
    } finally {
      setLoading(false);
    }
  }

  async function handleScanned(data: string) {
    if (scanned) return;
    setScanned(true);
    setScanMessage("QR detectado. Verificando credencial…");
    const reference = parseCredentialReference(data);
    if (!reference.id) {
      setScanMessage("QR inválido o no compatible con CertiChain.");
      return;
    }
    setTab("wallet");
    setSelected(null);
    await verify(reference.id, reference.hash);
  }

  function resetScanner() {
    setScanned(false);
    setScanMessage("Alinea el QR dentro del marco");
  }

  async function shareCredential(credential: WalletCredential) {
    const url = buildVerificationUrl(PUBLIC_VERIFY_URL, credentialId(credential));
    await Share.share({ message: buildShareMessage(credential.title, credential.institution, url) });
  }

  async function copyId(credential: WalletCredential) {
    await Clipboard.setStringAsync(credentialId(credential));
    Alert.alert("ID copiado", "El identificador de la credencial fue copiado.");
  }

  async function copyHash(credential: WalletCredential) {
    await Clipboard.setStringAsync(credential.documentHash);
    Alert.alert("SHA-256 copiado", "La evidencia de integridad fue copiada.");
  }

  async function openPublicVerifier(credential: WalletCredential) {
    const url = buildVerificationUrl(PUBLIC_VERIFY_URL, credentialId(credential));
    if (url.startsWith("http://") || url.startsWith("https://")) {
      await Linking.openURL(url);
    }
  }

  function clearHistory() {
    Alert.alert(
      "Eliminar historial local",
      "Se eliminarán de este dispositivo las credenciales e historial guardados. Esto NO elimina, revoca ni modifica el certificado real.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void SecureStore.deleteItemAsync(WALLET_KEY).then(() => {
              setWallet([]);
              setSelected(null);
              setOutcome(null);
            });
          },
        },
      ],
    );
  }

  function renderChecks(verification: Verification, documentHash?: string) {
    const blockchain = verification.checks?.blockchain;
    const items = [
      { label: "Registro off-chain", value: verification.checks?.existsOffChain ? "Confirmado" : "No confirmado", ok: Boolean(verification.checks?.existsOffChain) },
      { label: "Hash SHA-256", value: verification.checks?.hashMatches ? "Coincide" : "No coincide", ok: Boolean(verification.checks?.hashMatches) },
      { label: "Blockchain", value: blockchain ? "Consultada" : blockchainConfigured === false ? "No configurada" : "No disponible", ok: Boolean(blockchain) },
    ];

    return (
      <View style={styles.checkList} accessibilityRole="summary">
        {items.map((item) => (
          <View key={item.label} style={styles.checkRow}>
            <View style={[styles.checkDot, item.ok ? styles.checkDotOk : styles.checkDotNeutral]} />
            <View style={styles.flexOne}>
              <Text style={styles.checkLabel}>{item.label}</Text>
              <Text style={styles.checkValue}>{item.value}</Text>
            </View>
          </View>
        ))}
        {documentHash ? <Text style={styles.hashText}>{shortHash(documentHash)}</Text> : null}
      </View>
    );
  }

  function renderOutcome() {
    if (!outcome) return null;
    const certificate = outcome.verification?.certificate;
    const tone = outcome.kind === "valid" ? "success" : outcome.kind === "pending" ? "warning" : "danger";
    return (
      <View
        style={[styles.outcomeCard, tone === "success" ? styles.outcomeSuccess : tone === "warning" ? styles.outcomeWarning : styles.outcomeDanger]}
        accessible
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.eyebrow}>RESULTADO</Text>
        <Text style={styles.outcomeTitle}>{outcomeTitle(outcome)}</Text>
        {certificate ? <StatusBadge status={certificate.status} /> : null}
        {certificate ? <Text style={styles.body}>{certificate.title} · {certificate.institution}</Text> : null}
        {certificate?.status ? <Text style={styles.meta}>{statusDescription(certificate.status)}</Text> : null}
        {outcome.verification ? renderChecks(outcome.verification, outcome.documentHash) : null}
        {outcome.message ? <Text style={styles.errorText}>{outcome.message}</Text> : null}
        {outcome.kind === "error" ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void verify()} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  function renderCredentialDetail(credential: WalletCredential) {
    const url = buildVerificationUrl(PUBLIC_VERIFY_URL, credentialId(credential));
    return (
      <View style={styles.section}>
        <TouchableOpacity style={styles.textButton} onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Volver a mis credenciales">
          <Text style={styles.textButtonText}>Volver a mis credenciales</Text>
        </TouchableOpacity>
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Image source={BRAND_MARK} style={styles.detailMark} resizeMode="contain" />
            <StatusBadge status={credential.status} />
          </View>
          <Text style={styles.eyebrow}>CREDENCIAL ACADÉMICA</Text>
          <Text style={styles.detailTitle}>{credential.title}</Text>
          <Text style={styles.institution}>{credential.institution}</Text>
          <View style={styles.qrShell} accessible accessibilityLabel="Código QR de verificación pública de la credencial">
            <QRCode value={url} size={qrSize} backgroundColor={colors.white} color="#081126" />
          </View>
          <Text style={styles.qrCaption}>QR compatible con el verificador público actual</Text>
          <View style={styles.detailList}>
            <DetailRow label="Estudiante" value={credential.studentName} />
            <DetailRow label="Fecha de emisión" value={formatDate(credential.issuedAt)} />
            <DetailRow label="Estado actual" value={statusDescription(credential.status)} />
            <DetailRow label="ID / Blockchain ID" value={credentialId(credential)} mono />
            <DetailRow label="SHA-256" value={credential.documentHash} mono />
            <DetailRow label="Última verificación" value={formatDate(credential.verifiedAt, true)} />
          </View>
          {renderChecks({ valid: credential.status === "active", certificate: credential, checks: { existsOffChain: true, hashMatches: true, blockchain: null } }, credential.documentHash)}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify(credentialId(credential))} disabled={loading} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{loading ? "Validando…" : "Validar estado ahora"}</Text>
          </TouchableOpacity>
          <View style={styles.actionGrid}>
            <ActionButton label="Compartir credencial" onPress={() => void shareCredential(credential)} />
            <ActionButton label="Copiar ID" onPress={() => void copyId(credential)} />
            <ActionButton label="Copiar SHA-256" onPress={() => void copyHash(credential)} />
            {(url.startsWith("http://") || url.startsWith("https://")) ? <ActionButton label="Abrir verificador" onPress={() => void openPublicVerifier(credential)} /> : null}
          </View>
        </View>
      </View>
    );
  }

  function renderWallet() {
    if (selected) return renderCredentialDetail(selected);
    return (
      <View style={styles.section}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CERTICHAIN MOBILE WALLET</Text>
          <Text style={styles.heroTitle}>Credenciales verificables, claras y bajo tu control.</Text>
          <Text style={styles.body}>Valida por ID o escanea el QR. El SHA-256 se recupera automáticamente desde CertiChain.</Text>
        </View>
        <View style={styles.statsGrid}>
          <Stat value={stats.total} label="Guardadas" />
          <Stat value={stats.active} label="Vigentes" />
          <Stat value={stats.pending} label="Pendientes" />
          <Stat value={stats.revoked} label="Revocadas" />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>VERIFICACIÓN RÁPIDA</Text>
          <Text style={styles.cardTitle}>Verificar credencial</Text>
          <Text style={styles.inputLabel}>ID / Blockchain ID</Text>
          <TextInput
            value={certificateId}
            onChangeText={setCertificateId}
            placeholder="Introduce el identificador"
            placeholderTextColor="#65749D"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={() => void verify()}
            accessibilityLabel="ID o Blockchain ID de la credencial"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify()} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>Verificar credencial</Text>}
          </TouchableOpacity>
        </View>
        {renderOutcome()}
        <View style={styles.sectionHeading}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>Mis credenciales</Text>
            <Text style={styles.meta}>Último estado conocido; revalida cuando necesites confirmación actual.</Text>
          </View>
          <TouchableOpacity style={styles.compactButton} onPress={() => { setTab("scan"); resetScanner(); }} accessibilityRole="button">
            <Text style={styles.compactButtonText}>Escanear QR</Text>
          </TouchableOpacity>
        </View>
        {wallet.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={BRAND_MARK} style={styles.emptyMark} resizeMode="contain" />
            <Text style={styles.cardTitle}>Wallet vacía</Text>
            <Text style={styles.bodyCentered}>Verifica una credencial para guardarla de forma segura en este dispositivo.</Text>
          </View>
        ) : wallet.map((credential) => (
          <CredentialCard key={credentialId(credential)} credential={credential} mark={BRAND_MARK} onPress={() => setSelected(credential)} />
        ))}
      </View>
    );
  }

  function renderScanner() {
    if (!permission) {
      return <CenteredMessage title="Preparando la cámara" message="CertiChain está comprobando el permiso de cámara." />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.centered}>
          <Image source={BRAND_MARK} style={styles.permissionMark} resizeMode="contain" />
          <Text style={styles.detailTitle}>Permiso de cámara</Text>
          <Text style={styles.bodyCentered}>La cámara se usa únicamente para leer códigos QR de credenciales. CertiChain no necesita grabar audio.</Text>
          <TouchableOpacity style={styles.primaryButtonWide} onPress={() => void requestPermission()} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Permitir cámara</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>ESCÁNER QR</Text>
          <Text style={styles.detailTitle}>Escanear credencial</Text>
          <Text style={styles.body}>Compatible con QR moderno, deep link legacy con hash e identificadores de CertiChain.</Text>
        </View>
        <View style={styles.cameraFrame}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : ({ data }) => void handleScanned(data)}
          />
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={styles.scanBox} />
            <Text style={styles.scanHint}>{scanMessage}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={resetScanner} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>{scanned ? "Escanear otro código" : "Reiniciar escáner"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderHistory() {
    return (
      <View style={styles.section}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>HISTORIAL LOCAL</Text>
          <Text style={styles.detailTitle}>Validaciones recientes</Text>
          <Text style={styles.body}>Ordenado por la última verificación. Una credencial guardada no se considera vigente para siempre.</Text>
        </View>
        {wallet.length === 0 ? <CenteredMessage title="Sin historial" message="Aún no hay credenciales verificadas en este dispositivo." /> : wallet.map((credential) => (
          <TouchableOpacity
            key={credentialId(credential)}
            style={styles.historyRow}
            onPress={() => { setSelected(credential); setTab("wallet"); }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir historial de ${credential.title}`}
          >
            <Image source={BRAND_MARK} style={styles.historyMark} resizeMode="contain" />
            <View style={styles.flexOne}>
              <Text style={styles.historyTitle} numberOfLines={2}>{credential.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>{credential.institution}</Text>
              <Text style={styles.historyTime}>Última verificación: {formatDate(credential.verifiedAt, true)}</Text>
            </View>
            <StatusBadge status={credential.status} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  function renderProfile() {
    return (
      <View style={styles.section}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>PERFIL Y AJUSTES</Text>
          <Text style={styles.detailTitle}>CertiChain Wallet</Text>
          <Text style={styles.body}>Versión {APP_VERSION}. Privacidad por diseño y almacenamiento local seguro.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PRIVACIDAD POR DISEÑO</Text>
          <Text style={styles.cardTitle}>Documentos sensibles fuera de blockchain pública</Text>
          <Text style={styles.body}>La app conserva la wallet local en Expo SecureStore. La blockchain recibe evidencia mínima; no el documento académico completo.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>ENTORNO</Text>
          <Text style={styles.cardTitle}>{connectionLabel(connection)}</Text>
          <Text style={styles.mono} numberOfLines={3}>{API_URL || "EXPO_PUBLIC_API_URL no configurada"}</Text>
          <Text style={styles.meta}>En teléfono físico usa la IP LAN de tu PC. En Android Emulator usa 10.0.2.2. Producción futura debe usar HTTPS real.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void refreshConnection()} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Comprobar conexión</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dangerButton} onPress={clearHistory} accessibilityRole="button">
          <Text style={styles.dangerButtonText}>Eliminar historial local</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderTab(name: Tab, icon: TabIconName, label: string) {
    const active = tab === name;
    return (
      <TouchableOpacity
        key={name}
        style={styles.tabItem}
        onPress={() => {
          setTab(name);
          if (name === "wallet") setSelected(null);
          if (name === "scan") resetScanner();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <NavIcon name={icon} active={active} />
        <Text style={active ? styles.tabTextActive : styles.tabText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <BrandHeader logo={BRAND_LOGO} connection={connection} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tab === "wallet" ? renderWallet() : tab === "scan" ? renderScanner() : tab === "history" ? renderHistory() : renderProfile()}
        </ScrollView>
        <View style={styles.tabBar}>
          {renderTab("wallet", "home", "Inicio")}
          {renderTab("scan", "scan", "Escanear")}
          {renderTab("history", "history", "Historial")}
          {renderTab("profile", "profile", "Perfil")}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={mono ? styles.mono : styles.detailValue} selectable>{value}</Text></View>;
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.actionButton} onPress={onPress} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{label}</Text></TouchableOpacity>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function CenteredMessage({ title, message }: { title: string; message: string }) {
  return <View style={styles.centered}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.bodyCentered}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 28 },
  section: { gap: 14 },
  hero: { paddingTop: 22, gap: 8 },
  heroCompact: { paddingTop: 20, gap: 7 },
  eyebrow: { color: colors.cyan, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  heroTitle: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: "900", letterSpacing: -0.5 },
  detailTitle: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900" },
  institution: { color: "#C4B5FD", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  bodyCentered: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  meta: { color: colors.textSubtle, fontSize: 11, lineHeight: 16 },
  flexOne: { flex: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { width: "48%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: "700", marginTop: 2 },
  card: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 10 },
  cardEyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  cardTitle: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: -3 },
  input: { minHeight: 48, backgroundColor: "#080F24", color: colors.text, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 13, paddingHorizontal: 14, fontSize: 14 },
  primaryButton: { minHeight: 48, backgroundColor: colors.indigo, borderRadius: 13, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryButtonWide: { width: "100%", maxWidth: 340, minHeight: 48, backgroundColor: colors.indigo, borderRadius: 13, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#C7D2FE", fontSize: 12, fontWeight: "800", textAlign: "center" },
  compactButton: { minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  compactButtonText: { color: "#A78BFA", fontSize: 12, fontWeight: "900" },
  textButton: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 6 },
  textButtonText: { color: "#B39CFF", fontWeight: "900" },
  outcomeCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  outcomeSuccess: { backgroundColor: "#0A211D", borderColor: "#145C49" },
  outcomeWarning: { backgroundColor: "#2B2414", borderColor: "#765F1B" },
  outcomeDanger: { backgroundColor: "#24131D", borderColor: "#6F283D" },
  outcomeTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  errorText: { color: colors.redSoft, fontSize: 13, lineHeight: 19 },
  checkList: { gap: 8, paddingTop: 4 },
  checkRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#081126", borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 },
  checkDot: { width: 8, height: 8, borderRadius: 99 },
  checkDotOk: { backgroundColor: colors.green },
  checkDotNeutral: { backgroundColor: colors.amber },
  checkLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  checkValue: { color: colors.text, fontSize: 12, fontWeight: "800" },
  hashText: { color: "#B7A7FF", fontFamily: "monospace", fontSize: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  emptyState: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 22, alignItems: "center", gap: 8 },
  emptyMark: { width: 58, height: 58 },
  detailCard: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 20, padding: 16, gap: 11 },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailMark: { width: 50, height: 50 },
  qrShell: { backgroundColor: colors.white, padding: 14, borderRadius: 18, alignSelf: "center", marginTop: 3 },
  qrCaption: { color: colors.textSubtle, fontSize: 10, textAlign: "center" },
  detailList: { borderTopWidth: 1, borderTopColor: colors.border },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 3 },
  detailLabel: { color: colors.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  detailValue: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  mono: { color: "#B7A7FF", fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { width: "48%", flexGrow: 1, minHeight: 46, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  centered: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22 },
  permissionMark: { width: 72, height: 72 },
  cameraFrame: { height: 420, maxHeight: 520, minHeight: 320, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "#020617" },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 28 },
  scanBox: { width: "78%", aspectRatio: 1, borderWidth: 2, borderColor: colors.cyan, borderRadius: 20, backgroundColor: "transparent" },
  scanHint: { marginTop: 18, color: colors.white, backgroundColor: "rgba(5,8,23,0.88)", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, fontSize: 11, fontWeight: "800", textAlign: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 12 },
  historyMark: { width: 38, height: 38 },
  historyTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  historyTime: { color: colors.textSubtle, fontSize: 9, marginTop: 3 },
  dangerButton: { minHeight: 48, borderWidth: 1, borderColor: "#7F1D1D", backgroundColor: "#2C111B", borderRadius: 13, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { color: colors.redSoft, fontWeight: "900" },
  tabBar: { minHeight: 66, flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingTop: 7, paddingBottom: Platform.OS === "ios" ? 8 : 6 },
  tabItem: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 3 },
  tabText: { color: "#64748B", fontSize: 9, fontWeight: "700" },
  tabTextActive: { color: "#C4B5FD", fontSize: 9, fontWeight: "900" },
});
