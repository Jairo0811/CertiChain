import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
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
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import {
  CertificateStatus,
  parseCredentialReference,
  statusLabel,
  verificationVerdict,
} from "./src/verification";

declare const require: (path: string) => number;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const PUBLIC_VERIFY_URL = process.env.EXPO_PUBLIC_VERIFY_URL ?? "http://localhost:8080/verify";
const WALLET_KEY = "certichain-wallet-v1";
const BRAND_LOGO = require("./assets/branding/certichain-logo.png");
const BRAND_MARK = require("./assets/branding/certichain-isotipo.png");

type Tab = "wallet" | "scan" | "history" | "profile";
type TabIconName = "home" | "scan" | "history" | "profile";

type Certificate = {
  id: string;
  blockchainId?: string;
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  status: CertificateStatus;
};

type Verification = {
  valid: boolean;
  certificate?: Certificate;
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean;
    blockchain: unknown;
  };
  error?: string;
};

type EvidenceLookup = {
  documentHash: string;
  error?: string;
};

type WalletCredential = Certificate & {
  documentHash: string;
  verifiedAt: string;
};

function credentialId(certificate: Certificate) {
  return certificate.blockchainId ?? certificate.id;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function shortHash(hash: string) {
  return hash.length > 26 ? `${hash.slice(0, 14)}…${hash.slice(-10)}` : hash;
}

function verificationUrl(credential: WalletCredential) {
  try {
    const url = new URL(PUBLIC_VERIFY_URL);
    url.searchParams.set("id", credentialId(credential));
    url.searchParams.set("autoverify", "1");
    return url.toString();
  } catch {
    return `certichain://verify?id=${encodeURIComponent(credentialId(credential))}`;
  }
}

function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  const stroke = active ? "#c4b5fd" : "#64748b";
  const common = { stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === "home" && (
        <>
          <Path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" {...common} />
        </>
      )}
      {name === "scan" && (
        <>
          <Path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" {...common} />
          <Rect x="9" y="9" width="6" height="6" rx="1.5" {...common} />
        </>
      )}
      {name === "history" && (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M12 7.5V12l3 2" {...common} />
          <Path d="M6.2 6.2 4.5 4.5" {...common} />
        </>
      )}
      {name === "profile" && (
        <>
          <Circle cx="12" cy="8" r="3.2" {...common} />
          <Path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6" {...common} />
        </>
      )}
      <Line x1="0" y1="0" x2="0" y2="0" stroke={stroke} />
    </Svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("wallet");
  const [certificateId, setCertificateId] = useState("");
  const [resolvedHash, setResolvedHash] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [wallet, setWallet] = useState<WalletCredential[]>([]);
  const [selected, setSelected] = useState<WalletCredential | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

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

  async function verify(id = certificateId, suppliedHash?: string) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      Alert.alert("Falta el ID", "Introduce el ID o Blockchain ID de la credencial.");
      return;
    }

    setLoading(true);
    setVerification(null);

    try {
      let hash = suppliedHash?.trim() ?? "";
      if (!hash) {
        const evidenceResponse = await fetch(
          `${API_URL}/api/verify/${encodeURIComponent(normalizedId)}/evidence`,
        );
        const evidence = (await evidenceResponse.json()) as EvidenceLookup;
        if (!evidenceResponse.ok || !evidence.documentHash) {
          throw new Error(evidence.error ?? "No fue posible localizar la evidencia de la credencial.");
        }
        hash = evidence.documentHash;
      }

      const response = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(normalizedId)}?hash=${encodeURIComponent(hash)}`,
      );
      const body = (await response.json()) as Verification;
      if (!response.ok) {
        throw new Error(body.error ?? "No fue posible validar la credencial.");
      }

      setCertificateId(normalizedId);
      setResolvedHash(hash);
      setVerification(body);

      if (body.certificate) {
        const credential: WalletCredential = {
          ...body.certificate,
          documentHash: hash,
          verifiedAt: new Date().toISOString(),
        };
        const next = [
          credential,
          ...wallet.filter((item) => credentialId(item) !== credentialId(credential)),
        ].slice(0, 20);
        await persistWallet(next);
        setSelected((current) =>
          current && credentialId(current) === credentialId(credential) ? credential : current,
        );
      }
    } catch (error) {
      setResolvedHash("");
      setVerification({
        valid: false,
        error: error instanceof Error ? error.message : "No fue posible conectar con CertiChain.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyCredential(credential: WalletCredential) {
    await Clipboard.setStringAsync(
      `${credential.title} · ${credential.institution}\nID: ${credentialId(credential)}\n${verificationUrl(credential)}`,
    );
    Alert.alert("Copiado", "Los datos y el enlace de validación fueron copiados.");
  }

  async function shareCredential(credential: WalletCredential) {
    await Share.share({
      message: `${credential.title} · ${credential.institution}\n${verificationUrl(credential)}`,
    });
  }

  async function clearHistory() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Eliminar historial local",
        "Se borrarán del dispositivo las credenciales guardadas. Esto no elimina ni revoca certificados en CertiChain.",
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
          { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

    if (!confirmed) return;
    await persistWallet([]);
    setSelected(null);
    setVerification(null);
    setResolvedHash("");
    Alert.alert("Historial eliminado", "La wallet local quedó limpia.");
  }

  async function handleScanned(data: string) {
    if (scanned) return;
    setScanned(true);
    const reference = parseCredentialReference(data);
    if (!reference.id) {
      Alert.alert("QR no compatible", "No se encontró un ID de credencial CertiChain en este código.");
      return;
    }

    setTab("wallet");
    setSelected(null);
    await verify(reference.id, reference.hash);
  }

  function renderStatusBadge(status: CertificateStatus) {
    return (
      <View
        style={[
          styles.statusBadge,
          status === "active"
            ? styles.statusBadgeActive
            : status === "revoked"
              ? styles.statusBadgeRevoked
              : styles.statusBadgePending,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            status === "active"
              ? styles.statusDotActive
              : status === "revoked"
                ? styles.statusDotRevoked
                : styles.statusDotPending,
          ]}
        />
        <Text
          style={[
            styles.statusBadgeText,
            status === "active"
              ? styles.statusTextActive
              : status === "revoked"
                ? styles.statusTextRevoked
                : styles.statusTextPending,
          ]}
        >
          {statusLabel(status).toUpperCase()}
        </Text>
      </View>
    );
  }

  function renderVerificationResult() {
    if (!verification) return null;
    const status = verification.certificate?.status;
    const verdict = verificationVerdict(verification.valid, status);

    return (
      <View
        style={[
          styles.verificationCard,
          verification.valid ? styles.verificationCardValid : styles.verificationCardWarning,
        ]}
      >
        <View style={styles.verificationHeading}>
          <View
            style={[
              styles.verificationIcon,
              verification.valid ? styles.verificationIconValid : styles.verificationIconWarning,
            ]}
          >
            <Text style={styles.verificationIconText}>{verification.valid ? "✓" : "!"}</Text>
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.verificationEyebrow}>RESULTADO</Text>
            <Text style={styles.verificationTitle}>{verdict}</Text>
          </View>
        </View>

        {verification.certificate && (
          <View style={styles.resultDetails}>
            <Text style={styles.resultTitle}>{verification.certificate.title}</Text>
            <Text style={styles.body}>{verification.certificate.institution}</Text>
            <View style={styles.resultMetaRow}>
              {renderStatusBadge(verification.certificate.status)}
              <Text style={styles.meta}>ID verificado</Text>
            </View>
          </View>
        )}

        {verification.checks && (
          <View style={styles.checksRow}>
            <Text style={verification.checks.existsOffChain ? styles.checkOk : styles.checkFail}>
              {verification.checks.existsOffChain ? "✓" : "×"} Registro
            </Text>
            <Text style={verification.checks.hashMatches ? styles.checkOk : styles.checkFail}>
              {verification.checks.hashMatches ? "✓" : "×"} SHA-256
            </Text>
            <Text style={styles.checkNeutral}>
              {verification.checks.blockchain ? "Blockchain ✓" : "Off-chain"}
            </Text>
          </View>
        )}

        {resolvedHash && (
          <View style={styles.hashBox}>
            <Text style={styles.hashLabel}>SHA-256 recuperado automáticamente</Text>
            <Text style={styles.mono}>{shortHash(resolvedHash)}</Text>
          </View>
        )}

        {verification.error && <Text style={styles.error}>{verification.error}</Text>}
      </View>
    );
  }

  function renderCredentialCard(credential: WalletCredential) {
    return (
      <TouchableOpacity
        key={credentialId(credential)}
        style={styles.credentialCard}
        activeOpacity={0.86}
        onPress={() => setSelected(credential)}
        accessibilityRole="button"
        accessibilityLabel={`Abrir credencial ${credential.title}`}
      >
        <View style={styles.credentialHeader}>
          <View style={styles.brandMarkShell}>
            <Image source={BRAND_MARK} style={styles.brandMark} resizeMode="contain" />
          </View>
          {renderStatusBadge(credential.status)}
        </View>

        <Text style={styles.credentialTitle}>{credential.title}</Text>
        <Text style={styles.institutionText}>{credential.institution}</Text>
        <Text style={styles.meta}>{credential.studentName}</Text>

        <View style={styles.credentialFooter}>
          <View style={styles.flexOne}>
            <Text style={styles.detailLabel}>Emitido</Text>
            <Text style={styles.detailValueSmall}>{formatDate(credential.issuedAt)}</Text>
            <Text style={styles.mono} numberOfLines={1}>{credentialId(credential)}</Text>
          </View>
          <View style={styles.qrPreview}>
            <QRCode value={verificationUrl(credential)} size={76} backgroundColor="#ffffff" color="#081126" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderWallet() {
    if (selected) {
      return (
        <View style={styles.screenSection}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelected(null)}>
            <Text style={styles.backButtonText}>‹ Mis credenciales</Text>
          </TouchableOpacity>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Image source={BRAND_MARK} style={styles.detailBrandMark} resizeMode="contain" />
              {renderStatusBadge(selected.status)}
            </View>
            <Text style={styles.eyebrow}>CREDENCIAL ACADÉMICA</Text>
            <Text style={styles.credentialTitleLarge}>{selected.title}</Text>
            <Text style={styles.institutionTextLarge}>{selected.institution}</Text>

            <View style={styles.qrLarge}>
              <QRCode value={verificationUrl(selected)} size={184} backgroundColor="#ffffff" color="#081126" />
            </View>
            <Text style={styles.qrCaption}>Escanea para consultar el estado actual</Text>

            <View style={styles.detailList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Otorgado a</Text>
                <Text style={styles.detailValue}>{selected.studentName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fecha de emisión</Text>
                <Text style={styles.detailValue}>{formatDate(selected.issuedAt)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ID / Blockchain ID</Text>
                <Text style={styles.mono}>{credentialId(selected)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Última validación local</Text>
                <Text style={styles.detailValue}>{new Date(selected.verifiedAt).toLocaleString("es-DO")}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void verify(credentialId(selected))}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>{loading ? "Validando…" : "Validar estado ahora"}</Text>
            </TouchableOpacity>
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.secondaryButtonFlex} onPress={() => void shareCredential(selected)}>
                <Text style={styles.secondaryButtonText}>Compartir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButtonFlex} onPress={() => void copyCredential(selected)}>
                <Text style={styles.secondaryButtonText}>Copiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.screenSection}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>CERTICHAIN MOBILE WALLET</Text>
          </View>
          <Text style={styles.title}>Tus credenciales, verificadas y listas para compartir.</Text>
          <Text style={styles.body}>
            Consulta el estado criptográfico con un ID o escanea el QR. CertiChain recupera el SHA-256 automáticamente.
          </Text>
        </View>

        <View style={styles.walletStats}>
          <View style={styles.walletStatItem}>
            <Text style={styles.walletStatValue}>{wallet.length}</Text>
            <Text style={styles.walletStatLabel}>Guardadas</Text>
          </View>
          <View style={styles.walletStatDivider} />
          <View style={styles.walletStatItem}>
            <Text style={styles.walletStatValue}>{wallet.filter((item) => item.status === "active").length}</Text>
            <Text style={styles.walletStatLabel}>Vigentes</Text>
          </View>
          <View style={styles.walletStatDivider} />
          <View style={styles.walletStatItem}>
            <Text style={styles.walletStatValue}>{wallet.filter((item) => item.status === "revoked").length}</Text>
            <Text style={styles.walletStatLabel}>Revocadas</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>VALIDACIÓN RÁPIDA</Text>
          <Text style={styles.cardTitle}>Comprobar una credencial</Text>
          <Text style={styles.body}>
            Solo necesitas el ID. La evidencia SHA-256 se recupera desde el registro de CertiChain.
          </Text>
          <TextInput
            value={certificateId}
            onChangeText={setCertificateId}
            placeholder="ID o Blockchain ID"
            placeholderTextColor="#65749d"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={() => void verify()}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify()} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? "Verificando…" : "Verificar credencial"}</Text>
          </TouchableOpacity>
        </View>

        {renderVerificationResult()}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Mis credenciales</Text>
            <Text style={styles.meta}>Guardadas de forma segura en este dispositivo</Text>
          </View>
          <TouchableOpacity onPress={() => { setTab("scan"); setScanned(false); }}>
            <Text style={styles.sectionAction}>Escanear QR</Text>
          </TouchableOpacity>
        </View>

        {wallet.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={BRAND_MARK} style={styles.emptyBrandMark} resizeMode="contain" />
            <Text style={styles.cardTitle}>Tu wallet está vacía</Text>
            <Text style={styles.bodyCentered}>
              Valida un certificado por ID o escanea el QR de un Certificate PDF de CertiChain.
            </Text>
          </View>
        ) : (
          wallet.map(renderCredentialCard)
        )}
      </View>
    );
  }

  function renderScanner() {
    if (!permission) {
      return (
        <View style={styles.centered}>
          <Image source={BRAND_MARK} style={styles.permissionMark} resizeMode="contain" />
          <Text style={styles.body}>Preparando la cámara…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centered}>
          <Image source={BRAND_MARK} style={styles.permissionMark} resizeMode="contain" />
          <Text style={styles.titleSmall}>Activa la cámara</Text>
          <Text style={styles.bodyCentered}>
            CertiChain necesita acceso únicamente para leer códigos QR de credenciales.
          </Text>
          <TouchableOpacity style={styles.primaryButtonWide} onPress={() => void requestPermission()}>
            <Text style={styles.primaryButtonText}>Permitir cámara</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>VERIFICACIÓN MÓVIL</Text>
          <Text style={styles.titleSmall}>Escanear credencial</Text>
          <Text style={styles.body}>
            Compatible con los QR actuales del PDF: el ID se detecta y el SHA-256 se recupera automáticamente.
          </Text>
        </View>

        <View style={styles.cameraFrame}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : ({ data }) => void handleScanned(data)}
          />
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={styles.scanBox}>
              <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
              <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
              <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
            </View>
            <View style={styles.scanHint}>
              <Text style={styles.scanHintText}>{scanned ? "QR detectado" : "Alinea el QR dentro del marco"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setScanned(false)}>
          <Text style={styles.secondaryButtonText}>{scanned ? "Escanear otro código" : "Cámara lista"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderHistory() {
    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>HISTORIAL LOCAL</Text>
          <Text style={styles.titleSmall}>Validaciones recientes</Text>
          <Text style={styles.body}>
            Esta lista vive en SecureStore y refleja la última comprobación realizada desde este dispositivo.
          </Text>
        </View>

        {wallet.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.bodyCentered}>Todavía no hay verificaciones guardadas.</Text>
          </View>
        ) : (
          wallet.map((credential) => (
            <TouchableOpacity
              key={credentialId(credential)}
              style={styles.historyRow}
              onPress={() => {
                setSelected(credential);
                setTab("wallet");
              }}
            >
              <View style={styles.historyIconShell}>
                <Image source={BRAND_MARK} style={styles.historyIcon} resizeMode="contain" />
              </View>
              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>{credential.title}</Text>
                <Text style={styles.meta}>{credential.institution}</Text>
                <Text style={styles.historyTime}>{new Date(credential.verifiedAt).toLocaleString("es-DO")}</Text>
              </View>
              {renderStatusBadge(credential.status)}
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  function renderProfile() {
    return (
      <View style={styles.screenSection}>
        <View style={styles.heroCompact}>
          <Text style={styles.eyebrow}>PERFIL Y PRIVACIDAD</Text>
          <Text style={styles.titleSmall}>CertiChain Wallet</Text>
          <Text style={styles.body}>
            Una wallet académica local para consultar, verificar y compartir credenciales sin almacenar documentos sensibles en una cadena pública.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PRIVACIDAD POR DISEÑO</Text>
          <Text style={styles.cardTitle}>Tus datos permanecen bajo control</Text>
          <Text style={styles.body}>
            El historial se guarda localmente mediante Expo SecureStore. Eliminarlo aquí no modifica el registro institucional ni la blockchain.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>CONEXIÓN</Text>
          <Text style={styles.cardTitle}>API configurada</Text>
          <Text style={styles.mono} numberOfLines={2}>{API_URL}</Text>
          <Text style={styles.meta}>
            En un teléfono físico usa una URL alcanzable desde el dispositivo; `localhost` apunta al propio teléfono.
          </Text>
        </View>

        <TouchableOpacity style={styles.dangerButton} onPress={() => void clearHistory()}>
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
        style={[styles.tabItem, active && styles.tabItemActive]}
        onPress={() => {
          setTab(name);
          if (name === "wallet") setSelected(null);
          if (name === "scan") setScanned(false);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <TabIcon name={icon} active={active} />
        <Text style={active ? styles.tabTextActive : styles.tabText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#050817" />
      <View style={styles.app}>
        <View style={styles.brandRow}>
          <Image source={BRAND_LOGO} style={styles.brandLogo} resizeMode="contain" />
          <View style={styles.mobileBadge}>
            <Text style={styles.mobileBadgeText}>MOBILE</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "wallet"
            ? renderWallet()
            : tab === "scan"
              ? renderScanner()
              : tab === "history"
                ? renderHistory()
                : renderProfile()}
        </ScrollView>

        <View style={styles.tabBar}>
          {renderTab("wallet", "home", "Inicio")}
          {renderTab("scan", "scan", "Escanear")}
          {renderTab("history", "history", "Historial")}
          {renderTab("profile", "profile", "Perfil")}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050817" },
  app: { flex: 1, backgroundColor: "#070b1f" },
  flexOne: { flex: 1 },
  container: { paddingHorizontal: 18, paddingBottom: 118 },
  brandRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#151d3a",
    backgroundColor: "#060a1b",
  },
  brandLogo: { width: 172, height: 54 },
  mobileBadge: {
    borderWidth: 1,
    borderColor: "#273563",
    backgroundColor: "#101735",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mobileBadgeText: { color: "#9aa9d3", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  screenSection: { gap: 16 },
  hero: { paddingTop: 24, gap: 10 },
  heroCompact: { paddingTop: 24, gap: 7 },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#153d53",
    backgroundColor: "#082031",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#22d3ee" },
  heroBadgeText: { color: "#67e8f9", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  eyebrow: { color: "#22d3ee", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#f8fafc", fontSize: 31, lineHeight: 37, fontWeight: "900", letterSpacing: -0.7 },
  titleSmall: { color: "#f8fafc", fontSize: 27, lineHeight: 33, fontWeight: "900", letterSpacing: -0.4 },
  body: { color: "#a8b4d2", fontSize: 14, lineHeight: 21 },
  bodyCentered: { color: "#a8b4d2", fontSize: 14, lineHeight: 21, textAlign: "center" },
  card: {
    backgroundColor: "#0e1630",
    borderWidth: 1,
    borderColor: "#202d55",
    padding: 18,
    borderRadius: 22,
    gap: 12,
  },
  cardEyebrow: { color: "#67e8f9", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  cardTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  input: {
    backgroundColor: "#080f24",
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#2b3b6e",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#5b4cf0",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonWide: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#5b4cf0",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "white", fontWeight: "900", fontSize: 14 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#425486",
    backgroundColor: "#0b132b",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  secondaryButtonFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#425486",
    backgroundColor: "#0b132b",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#c7d2fe", fontWeight: "800" },
  actionGrid: { flexDirection: "row", gap: 10 },
  dangerButton: {
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#2c111b",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  dangerButtonText: { color: "#fca5a5", fontWeight: "900" },
  error: { color: "#fca5a5", lineHeight: 20 },
  meta: { color: "#8495c0", fontSize: 12, lineHeight: 17 },
  mono: { color: "#b7a7ff", fontFamily: "monospace", fontSize: 11, lineHeight: 17 },
  walletStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b1228",
    borderWidth: 1,
    borderColor: "#1e2a50",
    borderRadius: 18,
    paddingVertical: 14,
  },
  walletStatItem: { flex: 1, alignItems: "center", gap: 2 },
  walletStatValue: { color: "#f8fafc", fontSize: 20, fontWeight: "900" },
  walletStatLabel: { color: "#7180a8", fontSize: 10, fontWeight: "700" },
  walletStatDivider: { width: 1, height: 30, backgroundColor: "#26345f" },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 2 },
  sectionTitle: { color: "#f8fafc", fontSize: 19, fontWeight: "900" },
  sectionAction: { color: "#a78bfa", fontSize: 12, fontWeight: "900" },
  emptyState: {
    backgroundColor: "#0b132b",
    borderWidth: 1,
    borderColor: "#202d55",
    borderRadius: 22,
    padding: 26,
    alignItems: "center",
    gap: 9,
  },
  emptyBrandMark: { width: 64, height: 64, marginBottom: 2 },
  brandMarkShell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a1230",
    borderWidth: 1,
    borderColor: "#243568",
  },
  brandMark: { width: 34, height: 34 },
  credentialCard: {
    backgroundColor: "#0f1834",
    borderWidth: 1,
    borderColor: "#293766",
    padding: 17,
    borderRadius: 22,
    gap: 9,
  },
  credentialHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  credentialTitle: { color: "#f8fafc", fontSize: 21, lineHeight: 27, fontWeight: "900" },
  credentialTitleLarge: { color: "#f8fafc", fontSize: 28, lineHeight: 34, fontWeight: "900" },
  institutionText: { color: "#c4b5fd", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  institutionTextLarge: { color: "#c4b5fd", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  credentialFooter: { flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: 5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusBadgeActive: { backgroundColor: "#0b2b22", borderColor: "#135b43" },
  statusBadgeRevoked: { backgroundColor: "#32131d", borderColor: "#7f2638" },
  statusBadgePending: { backgroundColor: "#302815", borderColor: "#765f1b" },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusDotActive: { backgroundColor: "#4ade80" },
  statusDotRevoked: { backgroundColor: "#fb7185" },
  statusDotPending: { backgroundColor: "#fbbf24" },
  statusBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  statusTextActive: { color: "#86efac" },
  statusTextRevoked: { color: "#fda4af" },
  statusTextPending: { color: "#fde68a" },
  qrPreview: { backgroundColor: "#ffffff", padding: 8, borderRadius: 13 },
  detailCard: {
    backgroundColor: "#0e1630",
    borderWidth: 1,
    borderColor: "#283766",
    padding: 18,
    borderRadius: 24,
    gap: 12,
  },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailBrandMark: { width: 54, height: 54 },
  qrLarge: { backgroundColor: "#ffffff", padding: 15, borderRadius: 20, alignSelf: "center", marginTop: 4 },
  qrCaption: { color: "#7180a8", fontSize: 11, textAlign: "center", marginTop: -3 },
  detailList: { gap: 0, marginVertical: 4, borderTopWidth: 1, borderTopColor: "#24315b" },
  detailRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#202d55", gap: 3 },
  detailLabel: { color: "#7180a8", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  detailValue: { color: "#e8ecf8", fontSize: 14, fontWeight: "800" },
  detailValueSmall: { color: "#e8ecf8", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  backButton: { alignSelf: "flex-start", marginTop: 14, paddingVertical: 8 },
  backButtonText: { color: "#b39cff", fontWeight: "900" },
  verificationCard: { borderWidth: 1, padding: 16, borderRadius: 22, gap: 13 },
  verificationCardValid: { backgroundColor: "#0a211d", borderColor: "#145c49" },
  verificationCardWarning: { backgroundColor: "#24131d", borderColor: "#6f283d" },
  verificationHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  verificationIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  verificationIconValid: { backgroundColor: "#0d5a45" },
  verificationIconWarning: { backgroundColor: "#7a263d" },
  verificationIconText: { color: "#ffffff", fontSize: 21, fontWeight: "900" },
  verificationEyebrow: { color: "#67e8f9", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  verificationTitle: { color: "#f8fafc", fontSize: 19, fontWeight: "900", marginTop: 2 },
  resultDetails: { gap: 4 },
  resultTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  resultMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  checksRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  checkOk: { color: "#86efac", backgroundColor: "#0c3025", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: "800" },
  checkFail: { color: "#fda4af", backgroundColor: "#3a1822", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: "800" },
  checkNeutral: { color: "#b8c2df", backgroundColor: "#18223f", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: "800" },
  hashBox: { backgroundColor: "rgba(4,10,28,.45)", borderRadius: 13, padding: 11, gap: 3 },
  hashLabel: { color: "#7dd3fc", fontSize: 10, fontWeight: "800" },
  permissionMark: { width: 82, height: 82 },
  cameraFrame: { height: 430, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: "#354574", position: "relative", backgroundColor: "#020617" },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanBox: { width: 238, height: 238, position: "relative" },
  scanCorner: { position: "absolute", width: 42, height: 42, borderColor: "#67e8f9" },
  scanCornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  scanCornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  scanCornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  scanCornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanHint: { position: "absolute", bottom: 30, backgroundColor: "rgba(3,7,18,.78)", borderWidth: 1, borderColor: "rgba(103,232,249,.32)", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  scanHintText: { color: "#e0f2fe", fontSize: 11, fontWeight: "800" },
  centered: { flex: 1, minHeight: 520, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 24 },
  historyRow: { backgroundColor: "#0e1630", borderWidth: 1, borderColor: "#202d55", padding: 14, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 11 },
  historyIconShell: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#0a1230", borderWidth: 1, borderColor: "#243568" },
  historyIcon: { width: 32, height: 32 },
  historyContent: { flex: 1, gap: 2 },
  historyTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  historyTime: { color: "#65749d", fontSize: 10, marginTop: 2 },
  tabBar: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", gap: 4, backgroundColor: "rgba(7,12,29,.98)", borderWidth: 1, borderColor: "#202d55", padding: 7, borderRadius: 22 },
  tabItem: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 16 },
  tabItemActive: { backgroundColor: "#17163f" },
  tabText: { color: "#64748b", fontSize: 9, fontWeight: "700" },
  tabTextActive: { color: "#d8ccff", fontSize: 9, fontWeight: "900" },
});
