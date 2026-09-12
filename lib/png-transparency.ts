import { PNG } from "pngjs";
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
export function decodeImageDataUrl(value: string) {
  if (value.length > 16_000_000) throw new Error("IMAGE_TOO_LARGE");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error("INVALID_IMAGE_DATA");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2]) throw new Error("INVALID_IMAGE_DATA");
  return { mime: match[1], bytes };
}
// Bound allocations before decoding. pngjs checks CRCs and decodes every scanline.
export function validatePng(value: string, options: { transparent?: boolean; finalArtwork?: boolean } = {}) {
  const { mime, bytes } = decodeImageDataUrl(value);
  if (mime !== "image/png" || bytes.length < 45 || !bytes.subarray(0,8).equals(signature)) throw new Error("INVALID_PNG");
  if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii",12,16) !== "IHDR") throw new Error("INVALID_PNG");
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width * height > 16_000_000) throw new Error("IMAGE_DIMENSIONS_INVALID");
  let ended = false, sawData = false, dataEnded = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error("INVALID_PNG");
    const length = bytes.readUInt32BE(offset), name = bytes.toString("ascii",offset+4,offset+8);
    if (offset+length+12 > bytes.length || (name === "IHDR" && offset !== 8)) throw new Error("INVALID_PNG");
    if (name === "IDAT") { if (dataEnded) throw new Error("INVALID_PNG"); sawData = true; }
    else if (sawData) dataEnded = true;
    if (["acTL","fcTL","fdAT"].includes(name)) throw new Error("INVALID_PNG");
    offset += length+12;
    if (name === "IEND") { if (length || !sawData || offset !== bytes.length) throw new Error("INVALID_PNG"); ended = true; }
  }
  if (!ended) throw new Error("INVALID_PNG");
  let png: ReturnType<typeof PNG.sync.read>;
  try { png = PNG.sync.read(bytes,{checkCRC:true}); } catch { throw new Error("INVALID_PNG"); }
  if (png.width !== width || png.height !== height || png.data.length !== width*height*4) throw new Error("INVALID_PNG");
  let transparent = false, visible = false;
  for (let i=3;i<png.data.length;i+=4) { transparent ||= png.data[i]<255; visible ||= png.data[i]>0; }
  if (options.transparent && (!png.alpha || !transparent || !visible)) throw new Error("TRANSPARENT_PNG_REQUIRED");
  if (options.finalArtwork && (width !== 1080 || height !== 1350)) throw new Error("FINAL_ARTWORK_DIMENSIONS_INVALID");
  if (options.finalArtwork && transparent) throw new Error("FINAL_ARTWORK_MUST_BE_OPAQUE");
  return {width,height,transparent,bytes,pixels:png.data};
}
export function hasTransparentPng(value:string):boolean {
  try { validatePng(value,{transparent:true}); return true; } catch { return false; }
}
