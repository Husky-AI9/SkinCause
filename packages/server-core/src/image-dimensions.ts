export type ImageDimensions = { width: number; height: number };

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.byteLength < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.byteLength) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.byteLength) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6]
      };
    }
    offset += length;
  }
  return null;
}

export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png"
): ImageDimensions | null {
  return mimeType === "image/png" ? readPngDimensions(bytes) : readJpegDimensions(bytes);
}

export function validateSdImageDimensions(
  bytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png"
) {
  const dimensions = readImageDimensions(bytes, mimeType);
  if (!dimensions) throw new Error("IMAGE_DIMENSIONS_INVALID");
  if (Math.min(dimensions.width, dimensions.height) < 480) {
    throw new Error("IMAGE_TOO_SMALL");
  }
  return dimensions;
}
