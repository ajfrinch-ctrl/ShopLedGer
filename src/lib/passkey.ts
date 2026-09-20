/**
 * ফিঙ্গারপ্রিন্ট/ফেস লগইন — WebAuthn (passkey) দিয়ে।
 *
 * মূল কথা:
 * - যাচাই সম্পূর্ণ ব্রাউজারের ভেতরে হয় (`publicKey: 'direct'`),
 *   তাই কোনো সার্ভারে কিছু পাঠানো হয় না।
 * - প্রতিটি ডিভাইসে credential-টা সেভ থাকে এই ডিভাইসের IndexedDB-তে,
 *   যা ShopLedGer-এর "ডাটা এই ডিভাইসে" মডেলের সাথে মিলে যায়।
 * - Android-এ ফিঙ্গারপ্রিন্ট/ফেস, iPhone-এ Face ID/Touch ID ব্যবহার হয়।
 */

import { normalizePhone } from "./format";

export interface PasskeyRecord {
  /** base64url-encoded credential id */
  id: string;
  userId: string;
  userName: string;
  /** অ্যাকাউন্টের মোবাইল নম্বর (লগইন পেজে খোঁজার জন্য) */
  phone: string;
  /** base64url-encoded SPKI public key */
  pubKeySpki: string;
  /** JWK alg — -7 (ES256) অথবা -8 (ED25519) */
  alg: number;
  counter: number;
  createdAt: string;
}

export type PasskeyFail =
  | "unsupported"
  | "no-record"
  | "not-allowed"
  | "timeout"
  | "invalid"
  | "unknown";

export class PasskeyError extends Error {
  constructor(
    public reason: PasskeyFail,
  ) {
    super(reason);
    this.name = "PasskeyError";
  }
}

/** UI-তে দেখানো বাংলা এরর মেসেজ। */
export function passkeyErrorMessage(e: unknown): string {
  if (e instanceof PasskeyError) {
    switch (e.reason) {
      case "unsupported":
        return "এই ব্রাউজার/ডিভাইসে ফিঙ্গারপ্রিন্ট/পিন লগইন সমর্থিত নয়";
      case "no-record":
        return "এই নম্বরে কোনো ফিঙ্গারপ্রিন্ট লগইন সেট নেই";
      case "not-allowed":
        return "ভেরিফিকেশন বাতিল হয়েছে — চাইলে আবার চেষ্টা করুন";
      case "timeout":
        return "সময় শেষ — আবার চেষ্টা করুন";
      case "invalid":
        return "ভেরিফিকেশনে ব্যর্থ হয়েছে, পাসওয়ার্ড দিয়ে লগইন করুন";
      default:
        return "সমস্যা হয়েছে — আবার চেষ্টা করুন";
    }
  }
  return "সমস্যা হয়েছে — আবার চেষ্টা করুন";
}

const DB_NAME = "shopledger-passkeys";
const STORE = "records";
const RP_NAME = "ShopLedGer";
const TIMEOUT_MS = 60_000;

// ---------- small helpers ----------

function b64url(bytes: Uint8Array<ArrayBuffer>): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** ফোন নম্বর মিলানোর জন্য normalize — অ্যাপের বাকি ভাগের সাথে একই helper। */
export function normPhone(p: string): string {
  return normalizePhone(p);
}

function mapError(e: unknown): PasskeyError {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
        return new PasskeyError("not-allowed");
      case "TimeoutError":
        return new PasskeyError("timeout");
      case "SecurityError":
      case "InvalidStateError":
      case "ConstraintViolationError":
        return new PasskeyError("unsupported");
      default:
        break;
    }
  }
  return new PasskeyError("unknown");
}

// ---------- IndexedDB ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listPasskeys(): Promise<PasskeyRecord[]> {
  const d = await openDb();
  try {
    return await new Promise<PasskeyRecord[]>((resolve, reject) => {
      const req = d.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as PasskeyRecord[]).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt),
          ),
        );
      req.onerror = () => reject(req.error);
    });
  } finally {
    d.close();
  }
}

async function saveRecord(rec: PasskeyRecord): Promise<void> {
  const d = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}

async function removeRecord(id: string): Promise<void> {
  const d = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    d.close();
  }
}

async function bumpCounter(id: string, counter: number): Promise<void> {
  const d = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        const rec = req.result as PasskeyRecord | undefined;
        if (rec) tx.objectStore(STORE).put({ ...rec, counter });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    d.close();
  }
}

// ---------- public API ----------

/** এই ব্রাউজার/ডিভাইসে ফিঙ্গারপ্রিন্ট লগইন কাজ করবে কিনা। */
export function passkeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    typeof navigator !== "undefined" &&
    "credentials" in navigator
  );
}

/** কোনো ফোন নম্বরে পাসকি সেট আছে কিনা খোঁজা। */
export async function findPasskeyFor(phone: string): Promise<PasskeyRecord | null> {
  const target = normPhone(phone);
  if (!target || !passkeySupported()) return null;
  const all = await listPasskeys();
  return all.find((r) => normPhone(r.phone) === target) ?? null;
}

/**
 * লগইন অবস্থায় একবার চাপলে এই ডিভাইসে ফিঙ্গারপ্রিন্ট/ফেস সেট হয়।
 * ব্রাউজারের নিজস্ব ভায়োমেট্রিক প্রম্পট (ফিঙ্গারপ্রিন্ট/ফেস) দেখাবে।
 */
export async function createPasskey(account: {
  userId: string;
  userName: string;
  phone: string;
}): Promise<PasskeyRecord> {
  if (!passkeySupported()) throw new PasskeyError("unsupported");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  // সব আধুনিক ব্রাউজারে `publicKey` getter থাকে; পুরনো TS lib-এ টাইপ নেই
  type PublicKeyCredentialWithKey = PublicKeyCredential & {
    readonly publicKey: CryptoKey | null;
  };
  let cred: PublicKeyCredentialWithKey;
  try {
    const opts = {
      rp: { name: RP_NAME },
      user: {
        id: new TextEncoder().encode(account.userId),
        name: normPhone(account.phone) || account.userName,
        displayName: account.userName,
      },
      challenge,
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -8 }, // ED25519
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: TIMEOUT_MS,
      attestation: "none",
      // client-side verification — ব্রাউজার নিজে verify করে
      publicKey: { type: "direct" },
    } as unknown as PublicKeyCredentialCreationOptions;
    cred = (await navigator.credentials.create({ publicKey: opts })) as PublicKeyCredentialWithKey;
  } catch (e) {
    throw mapError(e);
  }
  if (!(cred instanceof PublicKeyCredential) || !cred.publicKey) {
    throw new PasskeyError("invalid");
  }
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", cred.publicKey));
  const jwk = (await crypto.subtle.exportKey("jwk", cred.publicKey)) as JsonWebKey;
  const rec: PasskeyRecord = {
    id: b64url(new Uint8Array(cred.rawId)),
    userId: account.userId,
    userName: account.userName,
    phone: account.phone,
    pubKeySpki: b64url(spki),
    alg: typeof jwk.alg === "number" ? jwk.alg : -7,
    counter: 0,
    createdAt: new Date().toISOString(),
  };
  await saveRecord(rec);
  return rec;
}

/**
 * সেট করা ফিঙ্গারপ্রিন্ট/ফেস দিয়ে ভেরিফাই — সফল হলে true,
 * ব্যর্থ হলে PasskeyError throw হয়।
 */
export async function verifyPasskey(record: PasskeyRecord): Promise<boolean> {
  if (!passkeySupported()) throw new PasskeyError("unsupported");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: fromB64url(record.id), type: "public-key" }],
        userVerification: "required",
        timeout: TIMEOUT_MS,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw mapError(e);
  }
  if (!(cred instanceof PublicKeyCredential) || b64url(new Uint8Array(cred.rawId)) !== record.id) {
    throw new PasskeyError("invalid");
  }
  const resp = cred.response;
  if (!(resp instanceof AuthenticatorAssertionResponse)) throw new PasskeyError("invalid");

  const clientData = new Uint8Array(resp.clientDataJSON);
  let client: { type?: string; challenge?: string };
  try {
    client = JSON.parse(new TextDecoder().decode(clientData));
  } catch {
    throw new PasskeyError("invalid");
  }
  if (client.type !== "webauthn.get" || client.challenge !== b64url(challenge)) {
    throw new PasskeyError("invalid");
  }

  // signature = authenticatorData || SHA-256(clientDataJSON)
  const authData = new Uint8Array(resp.authenticatorData);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientData));
  const sigData = new Uint8Array(authData.length + hash.length);
  sigData.set(authData, 0);
  sigData.set(hash, authData.length);

  const key =
    record.alg === -8
      ? await crypto.subtle.importKey(
          "spki",
          fromB64url(record.pubKeySpki),
          "Ed25519",
          false,
          ["verify"],
        )
      : await crypto.subtle.importKey(
          "spki",
          fromB64url(record.pubKeySpki),
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
  const ok =
    record.alg === -8
      ? await crypto.subtle.verify("Ed25519", key, new Uint8Array(resp.signature), sigData)
      : await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          key,
          new Uint8Array(resp.signature),
          sigData,
        );
  if (!ok) throw new PasskeyError("invalid");

  // counter clone-check + save
  const counter = readCounter(authData);
  const uvSet = (authData[32] & 0x04) !== 0;
  if (uvSet && counter < record.counter) throw new PasskeyError("invalid");
  await bumpCounter(record.id, Math.max(counter, record.counter + (uvSet ? 1 : 0)));
  return true;
}

/** এই ডিভাইস থেকে ফিঙ্গারপ্রিন্ট লগইন মুছে ফেলা। */
export async function removePasskey(id: string): Promise<void> {
  await removeRecord(id);
}

function readCounter(authData: Uint8Array<ArrayBuffer>): number {
  if (authData.length < 37) return 0;
  let n = 0;
  for (let i = 37; i >= 32; i--) n = n * 256 + authData[i];
  return n;
}
