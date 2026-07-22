import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const algorithm = "aes-256-gcm";
const keyByteLength = 32;
const ivByteLength = 12;

export type EncryptedPayload = {
  algorithm: typeof algorithm;
  iv: string;
  tag: string;
  data: string;
};

function getEncryptionKey() {
  const rawKey = process.env.HISTORY_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("缺少历史记录加密密钥，请设置 HISTORY_ENCRYPTION_KEY。");
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length !== keyByteLength) {
    throw new Error("HISTORY_ENCRYPTION_KEY 必须是 32 字节随机密钥的 base64 编码。");
  }

  return key;
}

export function encryptJson(value: unknown): EncryptedPayload {
  const iv = randomBytes(ivByteLength);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    algorithm,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

export function decryptJson<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;

  const encrypted = payload as Partial<EncryptedPayload>;
  if (encrypted.algorithm !== algorithm || !encrypted.iv || !encrypted.tag || !encrypted.data) return null;

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted.data, "base64")), decipher.final()]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
