import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const sessionDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newSessionSecret = () => randomBytes(32).toString("base64url");
export function tokenCipher(keyValue: string) {
  if (!/^[a-f0-9]{64}$/i.test(keyValue)) throw new Error("UNAUTHENTICATED");
  const key = Buffer.from(keyValue, "hex");
  return {
    encrypt(value: unknown) {
      const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64");
    },
    decrypt<T>(value: string): T {
      const bytes = Buffer.from(value, "base64"), decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as T;
    },
  };
}
