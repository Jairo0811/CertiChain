import { CertificateRecord } from "./domain.js";

interface CertificatePdfInput {
  id: string;
  studentName: string;
  studentWallet: string;
  title: string;
  institution: string;
  issuedAt: string;
}

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

function normalizePdfText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .split("")
    .map((character) => (character.charCodeAt(0) <= 255 ? character : "?"))
    .join("");
}

function escapePdfText(value: string): string {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function estimateTextWidth(value: string, fontSize: number, bold = false): number {
  return normalizePdfText(value).length * fontSize * (bold ? 0.56 : 0.5);
}

function fitFontSize(value: string, maxWidth: number, maxSize: number, minSize: number, bold = false): number {
  let size = maxSize;
  while (size > minSize && estimateTextWidth(value, size, bold) > maxWidth) size -= 0.5;
  return size;
}

function pushText(
  commands: string[],
  value: string,
  x: number,
  y: number,
  fontSize: number,
  options: {
    bold?: boolean;
    color?: [number, number, number];
    align?: "left" | "center" | "right";
  } = {},
): void {
  const { bold = false, color = [0.05, 0.08, 0.16], align = "left" } = options;
  const clean = normalizePdfText(value);
  const width = estimateTextWidth(clean, fontSize, bold);
  let textX = x;
  if (align === "center") textX = x - width / 2;
  if (align === "right") textX = x - width;

  commands.push(
    "BT",
    `${color.join(" ")} rg`,
    `/${bold ? "F2" : "F1"} ${fontSize.toFixed(1)} Tf`,
    `${textX.toFixed(2)} ${y.toFixed(2)} Td`,
    `(${escapePdfText(clean)}) Tj`,
    "ET",
  );
}

export function buildCertificatePdf(certificate: CertificatePdfInput | CertificateRecord): Buffer {
  const commands: string[] = [];

  commands.push("q", "1 1 1 rg", `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`, "Q");
  commands.push("q", "0.025 0.045 0.12 rg", `0 505 ${PAGE_WIDTH} 90 re f`, "Q");
  commands.push(
    "q",
    "0.02 0.45 0.95 rg",
    "0 500 420 5 re f",
    "0.49 0.23 0.93 rg",
    "420 500 421.89 5 re f",
    "Q",
  );

  commands.push(
    "q",
    "0.02 0.45 0.95 RG",
    "5 w",
    "60 550 m 72 566 l 92 566 l 104 550 l 92 534 l 72 534 l 60 550 l S",
    "0.49 0.23 0.93 RG",
    "5 w",
    "76 550 m 88 566 l 108 566 l 120 550 l 108 534 l 88 534 l 76 550 l S",
    "Q",
  );

  pushText(commands, "CertiChain", 138, 552, 22, { bold: true, color: [1, 1, 1] });
  pushText(commands, "Verified. Immutable. Trusted.", 138, 533, 9, { color: [0.65, 0.72, 0.9] });

  pushText(commands, "CERTIFICADO ACADEMICO", PAGE_WIDTH / 2, 458, 13, {
    bold: true,
    color: [0.02, 0.45, 0.95],
    align: "center",
  });
  pushText(commands, "Se certifica que", PAGE_WIDTH / 2, 423, 14, {
    color: [0.32, 0.38, 0.5],
    align: "center",
  });

  const studentSize = fitFontSize(certificate.studentName, 650, 31, 19, true);
  pushText(commands, certificate.studentName, PAGE_WIDTH / 2, 380, studentSize, {
    bold: true,
    color: [0.04, 0.07, 0.14],
    align: "center",
  });

  commands.push("q", "0.88 0.91 0.96 RG", "1 w", "150 358 m 692 358 l S", "Q");
  pushText(commands, "ha recibido la credencial academica", PAGE_WIDTH / 2, 328, 13, {
    color: [0.32, 0.38, 0.5],
    align: "center",
  });

  const titleSize = fitFontSize(certificate.title, 680, 24, 16, true);
  pushText(commands, certificate.title, PAGE_WIDTH / 2, 288, titleSize, {
    bold: true,
    color: [0.34, 0.18, 0.82],
    align: "center",
  });

  pushText(commands, "emitida por", PAGE_WIDTH / 2, 255, 11, {
    color: [0.38, 0.43, 0.54],
    align: "center",
  });
  const institutionSize = fitFontSize(certificate.institution, 650, 17, 12, true);
  pushText(commands, certificate.institution, PAGE_WIDTH / 2, 226, institutionSize, {
    bold: true,
    color: [0.04, 0.07, 0.14],
    align: "center",
  });
  pushText(commands, `Fecha de emision: ${certificate.issuedAt}`, PAGE_WIDTH / 2, 196, 11, {
    color: [0.32, 0.38, 0.5],
    align: "center",
  });

  commands.push(
    "q",
    "0.965 0.975 1 rg",
    "80 82 682 82 re f",
    "0.84 0.88 0.96 RG",
    "1 w",
    "80 82 682 82 re S",
    "Q",
  );
  pushText(commands, "ID DE CREDENCIAL", 102, 139, 8, {
    bold: true,
    color: [0.02, 0.45, 0.95],
  });
  pushText(commands, certificate.id, 102, 119, 10, { bold: true });
  pushText(commands, "WALLET DEL TITULAR", 440, 139, 8, {
    bold: true,
    color: [0.49, 0.23, 0.93],
  });
  const wallet = certificate.studentWallet.length > 42
    ? `${certificate.studentWallet.slice(0, 20)}...${certificate.studentWallet.slice(-12)}`
    : certificate.studentWallet;
  pushText(commands, wallet, 440, 119, 9, { color: [0.15, 0.19, 0.3] });
  pushText(
    commands,
    "Consulta el estado actual y la autenticidad en el Verificador CertiChain.",
    PAGE_WIDTH / 2,
    93,
    8.5,
    { color: [0.32, 0.38, 0.5], align: "center" },
  );

  commands.push("q", "0.025 0.045 0.12 rg", `0 0 ${PAGE_WIDTH} 52 re f`, "Q");
  pushText(commands, "CertiChain - Sistema de credenciales academicas verificables", 54, 25, 8.5, {
    color: [0.72, 0.78, 0.92],
  });
  pushText(
    commands,
    "Este PDF conserva la evidencia emitida. El estado puede cambiar por revocacion.",
    PAGE_WIDTH - 54,
    25,
    8.5,
    { color: [0.72, 0.78, 0.92], align: "right" },
  );

  const content = `${commands.join("\n")}\n`;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`;
  objects[4] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`;
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
