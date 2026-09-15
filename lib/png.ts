export const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

export function pngDimensions(dataUrl: string) {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) throw new Error("FINAL_ARTWORK_MUST_BE_PNG");
  const bytes = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), "base64");
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("INVALID_PNG");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes };
}
