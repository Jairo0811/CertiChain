import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
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

type Rgb = [number, number, number];
type PdfObject = Buffer;

type RasterBrand = {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  data: Buffer;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const BRAND_DISPLAY_MAX_WIDTH = 230;
const BRAND_DISPLAY_MAX_HEIGHT = 66;
const HEADER_BACKGROUND: readonly [number, number, number] = [7, 14, 36];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ORIGINAL_BRAND_PNG = readFileSync(
  new URL("../../web/public/branding/certichain-logo.png", import.meta.url),
);

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

function fitFontSize(
  value: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  bold = false,
): number {
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
    color?: Rgb;
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

function pushRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: Rgb; stroke?: Rgb; lineWidth?: number },
): void {
  commands.push("q");
  if (options.fill) commands.push(`${options.fill.join(" ")} rg`);
  if (options.stroke) {
    commands.push(`${options.stroke.join(" ")} RG`, `${options.lineWidth ?? 1} w`);
  }
  commands.push(
    `${x} ${y} ${width} ${height} re ${
      options.fill && options.stroke ? "B" : options.fill ? "f" : "S"
    }`,
    "Q",
  );
}

function pushLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Rgb,
  lineWidth = 1,
): void {
  commands.push(
    "q",
    `${color.join(" ")} RG`,
    `${lineWidth} w`,
    `${x1} ${y1} m ${x2} ${y2} l S`,
    "Q",
  );
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const p = left + up - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upperLeft;
}

function decodeOriginalBrandPng(png: Buffer): {
  width: number;
  height: number;
  rgba: Buffer;
} {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("CertiChain branding asset is not a valid PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) throw new Error("CertiChain PNG contains a truncated chunk");

    const data = png.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || idatChunks.length === 0) {
    throw new Error("CertiChain PNG is missing image data");
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error("CertiChain PNG uses an unsupported pixel format");
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const expectedLength = height * (stride + 1);
  if (inflated.length !== expectedLength) {
    throw new Error("CertiChain PNG scanline length is invalid");
  }

  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[sourceOffset] ?? 0;
    sourceOffset += 1;
    const rowOffset = row * stride;
    const previousRowOffset = (row - 1) * stride;

    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[sourceOffset + column] ?? 0;
      const left = column >= bytesPerPixel ? pixels[rowOffset + column - bytesPerPixel] ?? 0 : 0;
      const up = row > 0 ? pixels[previousRowOffset + column] ?? 0 : 0;
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? pixels[previousRowOffset + column - bytesPerPixel] ?? 0
          : 0;

      let value: number;
      switch (filterType) {
        case 0:
          value = raw;
          break;
        case 1:
          value = (raw + left) & 0xff;
          break;
        case 2:
          value = (raw + up) & 0xff;
          break;
        case 3:
          value = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          value = (raw + paethPredictor(left, up, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter ${filterType}`);
      }
      pixels[rowOffset + column] = value;
    }

    sourceOffset += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const sourceIndex = pixelIndex * bytesPerPixel;
    const targetIndex = pixelIndex * 4;
    rgba[targetIndex] = pixels[sourceIndex] ?? 0;
    rgba[targetIndex + 1] = pixels[sourceIndex + 1] ?? 0;
    rgba[targetIndex + 2] = pixels[sourceIndex + 2] ?? 0;
    rgba[targetIndex + 3] = colorType === 6 ? pixels[sourceIndex + 3] ?? 255 : 255;
  }

  return { width, height, rgba };
}

function visibleBounds(decoded: { width: number; height: number; rgba: Buffer }) {
  let minX = decoded.width;
  let minY = decoded.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const alpha = decoded.rgba[(y * decoded.width + x) * 4 + 3] ?? 255;
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: decoded.width, height: decoded.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function buildOriginalBrandRaster(): RasterBrand {
  const decoded = decodeOriginalBrandPng(ORIGINAL_BRAND_PNG);
  const bounds = visibleBounds(decoded);
  const rgb = Buffer.alloc(bounds.width * bounds.height * 3);

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceX = bounds.x + x;
      const sourceY = bounds.y + y;
      const sourceIndex = (sourceY * decoded.width + sourceX) * 4;
      const targetIndex = (y * bounds.width + x) * 3;
      const alpha = (decoded.rgba[sourceIndex + 3] ?? 255) / 255;

      for (let channel = 0; channel < 3; channel += 1) {
        const foreground = decoded.rgba[sourceIndex + channel] ?? 0;
        const background = HEADER_BACKGROUND[channel] ?? 0;
        rgb[targetIndex + channel] = Math.round(foreground * alpha + background * (1 - alpha));
      }
    }
  }

  const displayScale = Math.min(
    BRAND_DISPLAY_MAX_WIDTH / bounds.width,
    BRAND_DISPLAY_MAX_HEIGHT / bounds.height,
  );

  return {
    width: bounds.width,
    height: bounds.height,
    displayWidth: bounds.width * displayScale,
    displayHeight: bounds.height * displayScale,
    data: deflateSync(rgb, { level: 9 }),
  };
}

const ORIGINAL_BRAND_RASTER = buildOriginalBrandRaster();

function formatIssuedDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];
  const month = months[Number(match[2]) - 1];
  return month ? `${match[3]} ${month} ${match[1]}` : value;
}

function buildVerificationUrl(certificateId: string): string {
  const url = new URL(config.PUBLIC_VERIFY_URL);
  url.searchParams.set("id", certificateId);
  url.searchParams.set("autoverify", "1");
  return url.toString();
}

function pushQrCode(commands: string[], value: string, x: number, y: number, size: number): void {
  const matrix = buildQrMatrix(value);
  const quietZone = 4;
  const moduleSize = size / (matrix.length + quietZone * 2);
  pushRect(commands, x, y, size, size, {
    fill: [1, 1, 1],
    stroke: [0.72, 0.8, 0.93],
    lineWidth: 0.8,
  });
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
        commands.push(
          `${moduleX.toFixed(2)} ${moduleY.toFixed(2)} ${(runLength * moduleSize).toFixed(2)} ${moduleSize.toFixed(2)} re f`,
        );
        runStart = -1;
      }
    }
  });
  commands.push("Q");
}

function buildPdf(commands: string[]): Buffer {
  const content = Buffer.from(`${commands.join("\n")}\n`, "latin1");
  const objects: Array<PdfObject | undefined> = [];

  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1");
  objects[3] = Buffer.from(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Logo 7 0 R >> >> /Contents 4 0 R >>`,
    "latin1",
  );
  objects[4] = Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
    content,
    Buffer.from("endstream", "latin1"),
  ]);
  objects[5] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "latin1",
  );
  objects[6] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "latin1",
  );
  objects[7] = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${ORIGINAL_BRAND_RASTER.width} /Height ${ORIGINAL_BRAND_RASTER.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${ORIGINAL_BRAND_RASTER.data.length} >>\nstream\n`,
      "latin1",
    ),
    ORIGINAL_BRAND_RASTER.data,
    Buffer.from("\nendstream", "latin1"),
  ]);

  const chunks: Buffer[] = [];
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1");
  chunks.push(header);
  let length = header.length;
  const offsets: number[] = [0];

  for (let index = 1; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) throw new Error(`Missing PDF object ${index}`);
    offsets[index] = length;
    const prefix = Buffer.from(`${index} 0 obj\n`, "latin1");
    const suffix = Buffer.from("\nendobj\n", "latin1");
    chunks.push(prefix, object, suffix);
    length += prefix.length + object.length + suffix.length;
  }

  const xrefOffset = length;
  const xrefLines = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let index = 1; index < objects.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }
  xrefLines.push(
    "trailer",
    `<< /Size ${objects.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  );
  chunks.push(Buffer.from(xrefLines.join("\n"), "latin1"));

  return Buffer.concat(chunks);
}

export function buildCertificatePdf(certificate: CertificatePdfInput | CertificateRecord): Buffer {
  const commands: string[] = [];
  const verificationUrl = buildVerificationUrl(certificate.id);

  pushRect(commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, { fill: [0.975, 0.98, 1] });
  pushRect(commands, 0, 487, PAGE_WIDTH, 108.28, { fill: [0.027, 0.055, 0.14] });
  pushRect(commands, 0, 483, PAGE_WIDTH / 2, 4, { fill: [0.04, 0.47, 0.98] });
  pushRect(commands, PAGE_WIDTH / 2, 483, PAGE_WIDTH / 2, 4, { fill: [0.49, 0.23, 0.93] });

  const brandY = 508 + Math.max(0, (62 - ORIGINAL_BRAND_RASTER.displayHeight) / 2);
  commands.push(
    "q",
    `${ORIGINAL_BRAND_RASTER.displayWidth.toFixed(2)} 0 0 ${ORIGINAL_BRAND_RASTER.displayHeight.toFixed(2)} 48 ${brandY.toFixed(2)} cm`,
    "/Logo Do",
    "Q",
  );

  pushText(commands, "CERTIFICADO ACADÉMICO VERIFICABLE", 56, 449, 10, {
    bold: true,
    color: [0.02, 0.44, 0.93],
  });
  pushText(commands, "Se certifica que", 56, 421, 12, { color: [0.35, 0.4, 0.52] });
  const studentSize = fitFontSize(certificate.studentName, 525, 31, 19, true);
  pushText(commands, certificate.studentName, 56, 382, studentSize, {
    bold: true,
    color: [0.035, 0.06, 0.13],
  });
  pushRect(commands, 56, 358, 96, 3.2, { fill: [0.04, 0.47, 0.98] });
  pushRect(commands, 152, 358, 96, 3.2, { fill: [0.49, 0.23, 0.93] });
  pushText(commands, "ha recibido la credencial académica", 56, 333, 11.5, {
    color: [0.35, 0.4, 0.52],
  });
  const titleSize = fitFontSize(certificate.title, 520, 22, 15, true);
  pushText(commands, certificate.title, 56, 299, titleSize, {
    bold: true,
    color: [0.37, 0.19, 0.82],
  });
  pushText(commands, "EMITIDA POR", 56, 266, 8.5, {
    bold: true,
    color: [0.39, 0.45, 0.57],
  });
  const institutionSize = fitFontSize(certificate.institution, 510, 16, 11, true);
  pushText(commands, certificate.institution, 56, 242, institutionSize, {
    bold: true,
    color: [0.035, 0.06, 0.13],
  });
  pushText(
    commands,
    `Fecha de emisión · ${formatIssuedDate(certificate.issuedAt)}`,
    56,
    219,
    9.5,
    { color: [0.39, 0.45, 0.57] },
  );

  pushRect(commands, 618, 350, 170, 90, {
    fill: [0.955, 0.968, 1],
    stroke: [0.8, 0.85, 0.95],
    lineWidth: 0.7,
  });
  pushText(commands, "INTEGRIDAD DIGITAL", 636, 417, 8.2, {
    bold: true,
    color: [0.05, 0.54, 0.78],
  });
  pushRect(commands, 636, 392, 6, 6, { fill: [0.08, 0.78, 0.69] });
  pushText(commands, "SHA-256", 650, 390, 9.2, { bold: true, color: [0.08, 0.13, 0.24] });
  pushRect(commands, 636, 372, 6, 6, { fill: [0.28, 0.45, 0.98] });
  pushText(commands, "AES-256-GCM", 650, 370, 9.2, { bold: true, color: [0.08, 0.13, 0.24] });
  pushRect(commands, 636, 352, 6, 6, { fill: [0.55, 0.25, 0.95] });
  pushText(commands, "BLOCKCHAIN-READY", 650, 350, 8.8, {
    bold: true,
    color: [0.37, 0.19, 0.82],
  });

  pushRect(commands, 55, 70, 733, 124, {
    fill: [0.03, 0.065, 0.15],
    stroke: [0.12, 0.2, 0.38],
    lineWidth: 0.8,
  });
  pushText(commands, "IDENTIDAD DE LA CREDENCIAL", 76, 171, 8.5, {
    bold: true,
    color: [0.32, 0.87, 0.92],
  });
  pushText(commands, "ID", 76, 148, 7.3, {
    bold: true,
    color: [0.52, 0.63, 0.82],
  });
  pushText(commands, certificate.id, 76, 133, 9.1, { color: [0.96, 0.98, 1] });
  const wallet =
    certificate.studentWallet.length > 42
      ? `${certificate.studentWallet.slice(0, 20)}...${certificate.studentWallet.slice(-12)}`
      : certificate.studentWallet;
  pushText(commands, "WALLET / IDENTIDAD TÉCNICA", 76, 109, 7.3, {
    bold: true,
    color: [0.52, 0.63, 0.82],
  });
  pushText(commands, wallet, 76, 94, 8.5, { color: [0.84, 0.89, 0.99] });

  pushLine(commands, 407, 88, 407, 176, [0.15, 0.24, 0.43], 0.8);
  pushText(commands, "VALIDACIÓN POR QR", 430, 171, 8.5, {
    bold: true,
    color: [0.67, 0.46, 0.98],
  });
  pushText(commands, "Escanea para comprobar", 430, 145, 10.5, {
    bold: true,
    color: [0.96, 0.98, 1],
  });
  pushText(commands, "estado e integridad.", 430, 129, 10.5, {
    bold: true,
    color: [0.96, 0.98, 1],
  });
  pushText(commands, "Validación automática · CertiChain", 430, 103, 7.8, {
    color: [0.55, 0.73, 0.96],
  });
  pushQrCode(commands, verificationUrl, 690, 88, 82);

  pushLine(commands, 55, 50, 788, 50, [0.84, 0.87, 0.94], 0.7);
  pushText(
    commands,
    "Estado actual: consultar el QR o el Verificador CertiChain.",
    55,
    30,
    8.2,
    { color: [0.36, 0.42, 0.54] },
  );
  pushText(commands, "Verify once. Trust anywhere.", PAGE_WIDTH - 54, 30, 8.2, {
    bold: true,
    color: [0.37, 0.19, 0.82],
    align: "right",
  });

  return buildPdf(commands);
}
