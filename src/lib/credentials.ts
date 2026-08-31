import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "uniza_credentials";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PAYLOAD_VERSION = 1;

export type SavedCredentials = {
  email: string;
  password: string;
};

function getEncryptionKey(): Buffer | null {
  const secret = process.env.UNIZA_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHash("sha256").update(secret, "utf8").digest();
}

export function canPersistCredentials(): boolean {
  return getEncryptionKey() !== null;
}

export async function saveCredentials(credentials: SavedCredentials): Promise<boolean> {
  const key = getEncryptionKey();
  if (!key) return false;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const value = [
    PAYLOAD_VERSION.toString(),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return true;
}

export async function readCredentials(): Promise<SavedCredentials | null> {
  const key = getEncryptionKey();
  const cookieStore = await cookies();
  if (!key) {
    cookieStore.delete(COOKIE_NAME);
    cookieStore.delete("uniza_pass");
    return null;
  }

  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) {
    const legacyEmail = cookieStore.get("uniza_email")?.value;
    const legacyPassword = cookieStore.get("uniza_pass")?.value;
    if (!legacyEmail || !legacyPassword) return null;

    const credentials = { email: legacyEmail, password: legacyPassword };
    await saveCredentials(credentials);
    cookieStore.delete("uniza_pass");
    return credentials;
  }

  try {
    const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
    if (Number(version) !== PAYLOAD_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
      throw new Error("Unsupported credential payload");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<SavedCredentials>;

    if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
      throw new Error("Invalid credential payload");
    }
    cookieStore.delete("uniza_pass");
    return { email: parsed.email, password: parsed.password };
  } catch {
    cookieStore.delete(COOKIE_NAME);
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete("uniza_pass");
}
