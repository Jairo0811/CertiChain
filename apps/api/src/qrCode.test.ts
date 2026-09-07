import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildQrMatrix } from "./qrCode.js";

describe("certificate verification QR", () => {
  it("builds a standards-compatible Version 5-L matrix for the local verifier URL", () => {
    const matrix = buildQrMatrix(
      "http://localhost:8080/verify?id=555e26b1-c13d-494a-a251-53a98707bc4e",
    );

    expect(matrix).toHaveLength(37);
    expect(matrix.every((row) => row.length === 37)).toBe(true);

    const bits = matrix.flat().map((value) => value ? "1" : "0").join("");
    expect(createHash("sha256").update(bits).digest("hex")).toBe(
      "1e028e69db3d383012d2a3dbb4e12e92fac785577da60070dc99da02aeb70d21",
    );
  });

  it("rejects payloads that cannot fit the fixed QR profile", () => {
    expect(() => buildQrMatrix(`https://example.com/${"x".repeat(120)}`)).toThrow(/too long/i);
  });
});
