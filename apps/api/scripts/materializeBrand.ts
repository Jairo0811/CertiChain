import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../assets/branding/certichain-isotipo-header.jpg", import.meta.url));
const brand = await readFile(target);

function readJpegDimensions(image: Buffer): { width: number; height: number } | null {
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < image.length && image[offset] === 0xff) offset += 1;
    if (offset >= image.length) return null;

    const marker = image[offset];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) return null;

    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 1;
      continue;
    }

    if (offset + 2 >= image.length) return null;
    const segmentLength = image.readUInt16BE(offset + 1);
    const markerStart = offset - 1;

    if (marker >= 0xc0 && marker <= 0xc3) {
      if (segmentLength < 8 || markerStart + 9 >= image.length) return null;
      return {
        height: image.readUInt16BE(markerStart + 5),
        width: image.readUInt16BE(markerStart + 7),
      };
    }

    if (segmentLength < 2) return null;
    offset = markerStart + 2 + segmentLength;
  }

  return null;
}

if (brand.length < 1000) {
  throw new Error("CertiChain branding JPEG is unexpectedly small");
}

if (brand.at(-2) !== 0xff || brand.at(-1) !== 0xd9) {
  throw new Error("CertiChain branding JPEG is missing the EOI marker");
}

const dimensions = readJpegDimensions(brand);
if (!dimensions || dimensions.width !== 180 || dimensions.height !== 180) {
  throw new Error("CertiChain branding JPEG is malformed or has unexpected dimensions");
}

console.log(`Validated CertiChain PDF branding asset (${brand.length} bytes, ${dimensions.width}x${dimensions.height})`);
