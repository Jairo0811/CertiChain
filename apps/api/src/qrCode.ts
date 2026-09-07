const SIZE = 37;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const MAX_BYTE_PAYLOAD = 106;

export function buildQrMatrix(value: string): boolean[][] {
  const data = Buffer.from(value, "utf8");
  if (data.length > MAX_BYTE_PAYLOAD) {
    throw new Error(`Verification URL is too long for the embedded QR code (${data.length} bytes)`);
  }

  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));

  const setFunction = (row: number, column: number, dark: boolean) => {
    if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) return;
    modules[row]![column] = dark;
    isFunction[row]![column] = true;
  };

  const drawFinder = (centerRow: number, centerColumn: number) => {
    for (let rowOffset = -4; rowOffset <= 4; rowOffset += 1) {
      for (let columnOffset = -4; columnOffset <= 4; columnOffset += 1) {
        const distance = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
        setFunction(
          centerRow + rowOffset,
          centerColumn + columnOffset,
          distance !== 2 && distance !== 4,
        );
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(3, SIZE - 4);
  drawFinder(SIZE - 4, 3);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setFunction(6, index, index % 2 === 0);
    setFunction(index, 6, index % 2 === 0);
  }

  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
      setFunction(
        30 + rowOffset,
        30 + columnOffset,
        Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== 1,
      );
    }
  }

  drawFormatBits(setFunction);

  const codewords = encodeCodewords(data);
  const bits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1),
  );

  let bitIndex = 0;
  let right = SIZE - 1;
  let upward = true;

  while (right >= 1) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const row = upward ? SIZE - 1 - vertical : vertical;
      for (const column of [right, right - 1]) {
        if (isFunction[row]![column]) continue;
        const bit = bits[bitIndex] ?? 0;
        bitIndex += 1;
        const mask = (row + column) % 2 === 0;
        modules[row]![column] = Boolean(bit ^ Number(mask));
      }
    }

    upward = !upward;
    right -= 2;
  }

  return modules;
}

function encodeCodewords(data: Buffer): number[] {
  const bits: number[] = [];
  const appendBits = (value: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1);
  };

  appendBits(0b0100, 4);
  appendBits(data.length, 8);
  for (const byte of data) appendBits(byte, 8);

  const availableBits = DATA_CODEWORDS * 8 - bits.length;
  bits.push(...Array(Math.min(4, availableBits)).fill(0));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let value = 0;
    for (const bit of bits.slice(offset, offset + 8)) value = (value << 1) | bit;
    dataCodewords.push(value);
  }

  const padding = [0xec, 0x11] as const;
  let paddingIndex = 0;
  while (dataCodewords.length < DATA_CODEWORDS) {
    dataCodewords.push(padding[paddingIndex % padding.length]!);
    paddingIndex += 1;
  }

  return [...dataCodewords, ...reedSolomonRemainder(dataCodewords, reedSolomonDivisor(ECC_CODEWORDS))];
}

function reedSolomonDivisor(degree: number): number[] {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < degree; coefficient += 1) {
      result[coefficient] = gfMultiply(result[coefficient] ?? 0, root);
      if (coefficient + 1 < degree) {
        result[coefficient] = (result[coefficient] ?? 0) ^ (result[coefficient + 1] ?? 0);
      }
    }
    root = gfMultiply(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = Array<number>(divisor.length).fill(0);

  for (const byte of data) {
    const factor = byte ^ (result[0] ?? 0);
    result.shift();
    result.push(0);
    for (let index = 0; index < divisor.length; index += 1) {
      result[index] = (result[index] ?? 0) ^ gfMultiply(divisor[index] ?? 0, factor);
    }
  }

  return result;
}

function gfMultiply(left: number, right: number): number {
  let x = left;
  let y = right;
  let product = 0;

  for (let index = 0; index < 8; index += 1) {
    if ((y & 1) !== 0) product ^= x;
    y >>>= 1;
    x <<= 1;
    if ((x & 0x100) !== 0) x ^= 0x11d;
  }

  return product;
}

function drawFormatBits(setFunction: (row: number, column: number, dark: boolean) => void): void {
  const errorCorrectionLevelL = 1;
  const maskPattern = 0;
  const data = (errorCorrectionLevelL << 3) | maskPattern;
  let remainder = data << 10;

  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) remainder ^= 0x537 << (bit - 10);
  }

  const format = ((data << 10) | remainder) ^ 0x5412;
  const getBit = (index: number) => ((format >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index += 1) setFunction(index, 8, getBit(index));
  setFunction(7, 8, getBit(6));
  setFunction(8, 8, getBit(7));
  setFunction(8, 7, getBit(8));
  for (let index = 9; index < 15; index += 1) setFunction(8, 14 - index, getBit(index));

  for (let index = 0; index < 8; index += 1) setFunction(8, SIZE - 1 - index, getBit(index));
  for (let index = 8; index < 15; index += 1) setFunction(SIZE - 15 + index, 8, getBit(index));
  setFunction(SIZE - 8, 8, true);
}
