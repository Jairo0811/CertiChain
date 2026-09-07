import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_ISOTYPE } from "../src/brandIsotipo.js";

const target = fileURLToPath(new URL("../assets/branding/certichain-isotipo-header.jpg", import.meta.url));

if (BRAND_ISOTYPE.length < 1000) {
  throw new Error("CertiChain branding JPEG is unexpectedly small");
}

if (BRAND_ISOTYPE[0] !== 0xff || BRAND_ISOTYPE[1] !== 0xd8) {
  throw new Error("CertiChain branding JPEG is missing the SOI marker");
}

if (BRAND_ISOTYPE.at(-2) !== 0xff || BRAND_ISOTYPE.at(-1) !== 0xd9) {
  throw new Error("CertiChain branding JPEG is missing the EOI marker");
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, BRAND_ISOTYPE);
console.log(`Materialized CertiChain PDF branding asset (${BRAND_ISOTYPE.length} bytes)`);
