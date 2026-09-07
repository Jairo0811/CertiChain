import { config } from "./config.js";
import { CertificateRecord } from "./domain.js";
import { buildQrMatrix } from "./qrCode.js";

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

type Rgb = [number, number, number];
type Point = readonly [number, number];

function normalizePdfText(value: string): string {
  return value.replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().split("").map((character) => (character.charCodeAt(0) <= 255 ? character : "?")).join("");
}

function escapePdfText(value: string): string {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function estimateTextWidth(value: string, fontSize: number, bold = false): number {
  return normalizePdfText(value).length * fontSize * (bold ? 0.56 : 0.5);
}

function fitFontSize(value: string, maxWidth: number, maxSize: number, minSize: number, bold = false): number {
  let size = maxSize;
  while (size > minSize && estimateTextWidth(value, size, bold) > maxWidth) size -= 0.5;
  return size;
}

function pushText(commands: string[], value: string, x: number, y: number, fontSize: number, options: { bold?: boolean; color?: Rgb; align?: "left" | "center" | "right" } = {}): void {
  const { bold = false, color = [0.05, 0.08, 0.16], align = "left" } = options;
  const clean = normalizePdfText(value);
  const width = estimateTextWidth(clean, fontSize, bold);
  let textX = x;
  if (align === "center") textX = x - width / 2;
  if (align === "right") textX = x - width;
  commands.push("BT", `${color.join(" ")} rg`, `/${bold ? "F2" : "F1"} ${fontSize.toFixed(1)} Tf`, `${textX.toFixed(2)} ${y.toFixed(2)} Td`, `(${escapePdfText(clean)}) Tj`, "ET");
}

function pushRect(commands: string[], x: number, y: number, width: number, height: number, options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }): void {
  commands.push("q");
  if (options.fill) commands.push(`${options.fill.join(" ")} rg`);
  if (options.stroke) commands.push(`${options.stroke.join(" ")} RG`, `${options.lineWidth ?? 1} w`);
  commands.push(`${x} ${y} ${width} ${height} re ${options.fill && options.stroke ? "B" : options.fill ? "f" : "S"}`, "Q");
}

function pushLine(commands: string[], x1: number, y1: number, x2: number, y2: number, color: Rgb, lineWidth = 1): void {
  commands.push("q", `${color.join(" ")} RG`, `${lineWidth} w`, `${x1} ${y1} m ${x2} ${y2} l S`, "Q");
}

function pushPolygon(commands: string[], points: Point[], options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }): void {
  const first = points[0];
  if (!first || points.length < 3) return;
  commands.push("q");
  if (options.fill) commands.push(`${options.fill.join(" ")} rg`);
  if (options.stroke) commands.push(`${options.stroke.join(" ")} RG`, `${options.lineWidth ?? 1} w`);
  commands.push(`${first[0].toFixed(2)} ${first[1].toFixed(2)} m`);
  for (const [x, y] of points.slice(1)) commands.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
  commands.push(`h ${options.fill && options.stroke ? "B" : options.fill ? "f" : "S"}`, "Q");
}

function regularPolygon(centerX: number, centerY: number, radius: number, sides: number, rotation = 0): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius] as const;
  });
}

function pushHexagon(commands: string[], centerX: number, centerY: number, radius: number, color: Rgb): void {
  pushPolygon(commands, regularPolygon(centerX, centerY, radius, 6), { stroke: color, lineWidth: 0.55 });
}

function pushBrandIsotype(commands: string[], x: number, y: number, size: number): void {
  commands.push("% CERTICHAIN_VECTOR_ISOTYPE");
  const blue: Rgb = [0.05, 0.46, 0.98];
  const blueDeep: Rgb = [0.02, 0.25, 0.78];
  const violet: Rgb = [0.49, 0.23, 0.93];
  const violetLight: Rgb = [0.65, 0.38, 1];
  const cyan: Rgb = [0.08, 0.9, 0.86];
  const navy: Rgb = [0.025, 0.05, 0.13];
  const p = (px: number, py: number): Point => [x + px * size, y + py * size] as const;

  pushPolygon(commands, [
    p(0.05, 0.25), p(0.42, 0.03), p(0.60, 0.14), p(0.34, 0.30),
    p(0.34, 0.70), p(0.60, 0.86), p(0.42, 0.97), p(0.05, 0.75),
  ], { fill: blue, stroke: [0.25, 0.76, 1], lineWidth: 0.8 });
  pushPolygon(commands, [p(0.05, 0.25), p(0.17, 0.32), p(0.17, 0.68), p(0.05, 0.75)], { fill: blueDeep });

  pushPolygon(commands, [
    p(0.95, 0.25), p(0.58, 0.03), p(0.40, 0.14), p(0.66, 0.30),
    p(0.66, 0.43), p(0.83, 0.33), p(0.83, 0.67), p(0.66, 0.57),
    p(0.66, 0.70), p(0.40, 0.86), p(0.58, 0.97), p(0.95, 0.75),
  ], { fill: violet, stroke: violetLight, lineWidth: 0.8 });

  pushPolygon(commands, regularPolygon(x + size * 0.5, y + size * 0.5, size * 0.23, 6, Math.PI / 6), { fill: navy, stroke: [0.18, 0.32, 0.64], lineWidth: 0.7 });
  pushPolygon(commands, regularPolygon(x + size * 0.5, y + size * 0.5, size * 0.145, 6, Math.PI / 6), { fill: [0.02, 0.16, 0.22], stroke: cyan, lineWidth: 1.4 });
  pushLine(commands, x + size * 0.435, y + size * 0.50, x + size * 0.485, y + size * 0.445, cyan, 2.5);
  pushLine(commands, x + size * 0.485, y + size * 0.445, x + size * 0.58, y + size * 0.56, cyan, 2.5);
}

function pushBlockchainPattern(commands: string[]): void {
  const cyan: Rgb = [0.82, 0.92, 0.99];
  const violet: Rgb = [0.9, 0.86, 0.99];
  const nodes = [[530, 420], [570, 448], [612, 420], [653, 447], [698, 420], [742, 448], [785, 420], [548, 265], [594, 286], [640, 263], [688, 286], [734, 263], [778, 286]] as const;
  for (let index = 0; index < 6; index += 1) {
    const from = nodes[index];
    const to = nodes[index + 1];
    if (from && to) pushLine(commands, from[0], from[1], to[0], to[1], cyan, 0.55);
  }
  for (let index = 7; index < nodes.length - 1; index += 1) {
    const from = nodes[index];
    const to = nodes[index + 1];
    if (from && to) pushLine(commands, from[0], from[1], to[0], to[1], violet, 0.55);
  }
  for (const [nodeX, nodeY] of nodes) pushRect(commands, nodeX - 1.7, nodeY - 1.7, 3.4, 3.4, { fill: [0.76, 0.86, 0.98] });
  pushHexagon(commands, 751, 356, 31, violet);
  pushHexagon(commands, 751, 356, 19, cyan);
  pushHexagon(commands, 566, 353, 18, cyan);
}

function formatIssuedDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const month = months[Number(match[2]) - 1];
  return month ? `${match[3]} ${month} ${match[1]}` : value;
}

function buildVerificationUrl(certificateId: string): string {
  const url = new URL(config.PUBLIC_VERIFY_URL);
  url.searchParams.set("id", certificateId);
  return url.toString();
}

function pushQrCode(commands: string[], value: string, x: number, y: number, size: number): void {
  const matrix = buildQrMatrix(value);
  const quietZone = 4;
  const moduleSize = size / (matrix.length + quietZone * 2);
  pushRect(commands, x, y, size, size, { fill: [1, 1, 1], stroke: [0.78, 0.84, 0.95], lineWidth: 0.8 });
  commands.push("q", "0.03 0.07 0.16 rg");
  matrix.forEach((row, rowIndex) => {
    let runStart = -1;
    for (let column = 0; column <= row.length; column += 1) {
      const dark = column < row.length && row[column];
      if (dark && runStart < 0) runStart = column;
      if ((!dark || column === row.length) && runStart >= 0) {
        const runLength = column - runStart;
        const moduleX = x + (quietZone + runStart) * moduleSize;
        const moduleY = y + (quietZone + (matrix.length - 1 - rowIndex)) * moduleSize;
        commands.push(`${moduleX.toFixed(2)} ${moduleY.toFixed(2)} ${(runLength * moduleSize).toFixed(2)} ${moduleSize.toFixed(2)} re f`);
        runStart = -1;
      }
    }
  });
  commands.push("Q");
}

export function buildCertificatePdf(certificate: CertificatePdfInput | CertificateRecord): Buffer {
  const commands: string[] = [];
  const verificationUrl = buildVerificationUrl(certificate.id);
  pushRect(commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, { fill: [0.975, 0.98, 1] });
  pushBlockchainPattern(commands);
  pushRect(commands, 0, 482, PAGE_WIDTH, 113.28, { fill: [0.027, 0.055, 0.14] });
  pushRect(commands, 0, 477, PAGE_WIDTH / 2, 5, { fill: [0.04, 0.47, 0.98] });
  pushRect(commands, PAGE_WIDTH / 2, 477, PAGE_WIDTH / 2, 5, { fill: [0.49, 0.23, 0.93] });
  pushBrandIsotype(commands, 43, 511, 58);
  pushText(commands, "CertiChain", 116, 548, 24, { bold: true, color: [1, 1, 1] });
  pushText(commands, "Verified. Immutable. Trusted.", 116, 527, 9.5, { color: [0.55, 0.84, 0.96] });
  pushText(commands, "VERIFIABLE CREDENTIAL", PAGE_WIDTH - 50, 553, 8.5, { bold: true, color: [0.34, 0.9, 0.9], align: "right" });
  pushText(commands, "CREDENTIAL ID", PAGE_WIDTH - 50, 534, 7.5, { bold: true, color: [0.6, 0.67, 0.82], align: "right" });
  pushText(commands, certificate.id, PAGE_WIDTH - 50, 518, 8.5, { color: [0.92, 0.95, 1], align: "right" });
  pushText(commands, formatIssuedDate(certificate.issuedAt), PAGE_WIDTH - 50, 500, 8.5, { color: [0.66, 0.73, 0.88], align: "right" });

  pushText(commands, "CERTIFICADO ACADEMICO VERIFICABLE", 56, 443, 10, { bold: true, color: [0.02, 0.44, 0.93] });
  pushText(commands, "Se certifica que", 56, 416, 12, { color: [0.35, 0.4, 0.52] });
  const studentSize = fitFontSize(certificate.studentName, 525, 31, 19, true);
  pushText(commands, certificate.studentName, 56, 378, studentSize, { bold: true, color: [0.035, 0.06, 0.13] });
  pushRect(commands, 56, 354, 94, 3.5, { fill: [0.04, 0.47, 0.98] });
  pushRect(commands, 150, 354, 94, 3.5, { fill: [0.49, 0.23, 0.93] });
  pushText(commands, "ha recibido la credencial academica", 56, 329, 11.5, { color: [0.35, 0.4, 0.52] });
  const titleSize = fitFontSize(certificate.title, 520, 22, 15, true);
  pushText(commands, certificate.title, 56, 296, titleSize, { bold: true, color: [0.37, 0.19, 0.82] });
  pushText(commands, "EMITIDA POR", 56, 263, 8.5, { bold: true, color: [0.39, 0.45, 0.57] });
  const institutionSize = fitFontSize(certificate.institution, 510, 16, 11, true);
  pushText(commands, certificate.institution, 56, 239, institutionSize, { bold: true, color: [0.035, 0.06, 0.13] });
  pushText(commands, `Fecha de emision · ${formatIssuedDate(certificate.issuedAt)}`, 56, 216, 9.5, { color: [0.39, 0.45, 0.57] });

  pushRect(commands, 620, 334, 168, 112, { fill: [0.95, 0.965, 1], stroke: [0.78, 0.84, 0.95], lineWidth: 0.8 });
  pushText(commands, "TRUST LAYER", 638, 423, 8.5, { bold: true, color: [0.05, 0.54, 0.78] });
  pushText(commands, "SHA-256", 653, 397, 10, { bold: true, color: [0.08, 0.13, 0.24] });
  pushText(commands, "Integridad registrada", 653, 383, 7.5, { color: [0.39, 0.45, 0.57] });
  pushRect(commands, 638, 396, 7, 7, { fill: [0.08, 0.78, 0.69] });
  pushText(commands, "AES-256-GCM", 653, 365, 10, { bold: true, color: [0.08, 0.13, 0.24] });
  pushText(commands, "Evidencia cifrada", 653, 351, 7.5, { color: [0.39, 0.45, 0.57] });
  pushRect(commands, 638, 364, 7, 7, { fill: [0.28, 0.45, 0.98] });
  pushText(commands, "BLOCKCHAIN READY", 653, 333, 9, { bold: true, color: [0.37, 0.19, 0.82] });
  pushRect(commands, 638, 333, 7, 7, { fill: [0.55, 0.25, 0.95] });

  pushRect(commands, 55, 70, 733, 126, { fill: [0.03, 0.065, 0.15], stroke: [0.12, 0.2, 0.38], lineWidth: 0.8 });
  pushText(commands, "IDENTIDAD DE LA CREDENCIAL", 76, 173, 8.5, { bold: true, color: [0.32, 0.87, 0.92] });
  pushText(commands, "ID", 76, 151, 7.5, { bold: true, color: [0.52, 0.63, 0.82] });
  pushText(commands, certificate.id, 76, 136, 9.2, { color: [0.96, 0.98, 1] });
  const wallet = certificate.studentWallet.length > 42 ? `${certificate.studentWallet.slice(0, 20)}...${certificate.studentWallet.slice(-12)}` : certificate.studentWallet;
  pushText(commands, "WALLET / IDENTIDAD TECNICA", 76, 113, 7.5, { bold: true, color: [0.52, 0.63, 0.82] });
  pushText(commands, wallet, 76, 97, 8.7, { color: [0.84, 0.89, 0.99] });
  pushLine(commands, 407, 88, 407, 178, [0.15, 0.24, 0.43], 0.8);
  pushText(commands, "VERIFICACION PUBLICA", 430, 173, 8.5, { bold: true, color: [0.67, 0.46, 0.98] });
  pushText(commands, "Escanea el QR para consultar", 430, 149, 10.5, { bold: true, color: [0.96, 0.98, 1] });
  pushText(commands, "el estado actual y la evidencia.", 430, 133, 10.5, { bold: true, color: [0.96, 0.98, 1] });
  pushText(commands, config.PUBLIC_VERIFY_URL, 430, 110, 7.8, { color: [0.55, 0.73, 0.96] });
  pushText(commands, "El SHA-256 se recupera automaticamente", 430, 91, 7.4, { color: [0.63, 0.7, 0.84] });
  pushQrCode(commands, verificationUrl, 684, 86, 94);

  pushLine(commands, 55, 50, 788, 50, [0.84, 0.87, 0.94], 0.7);
  pushText(commands, "El estado es dinamico: vigencia y revocacion se consultan en el Verificador CertiChain.", 55, 30, 8.3, { color: [0.36, 0.42, 0.54] });
  pushText(commands, "Verify once. Trust anywhere.", PAGE_WIDTH - 54, 30, 8.3, { bold: true, color: [0.37, 0.19, 0.82], align: "right" });

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
  for (let index = 1; index < objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
