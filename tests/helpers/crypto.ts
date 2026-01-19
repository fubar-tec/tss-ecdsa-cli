import { createHash, randomBytes } from "node:crypto";

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function randomMessageHash(): string {
  return randomHex(32);
}

export function sha256(data: string | Buffer): string {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

export function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str);
}

export function isValidMessageHash(hash: string): boolean {
  return isValidHex(hash) && hash.length === 64;
}

export function isValidEcdsaPublicKey(pubkey: string): boolean {
  if (!isValidHex(pubkey)) return false;

  if (pubkey.length === 66) {
    return pubkey.startsWith("02") || pubkey.startsWith("03");
  }

  if (pubkey.length === 130) {
    return pubkey.startsWith("04");
  }

  return false;
}

export function isValidEddsaPublicKey(pubkey: string): boolean {
  return isValidHex(pubkey) && pubkey.length === 64;
}

export interface EcdsaSignature {
  r: string;
  s: string;
  recid?: number;
}

export function isValidEcdsaSignature(sig: EcdsaSignature): boolean {
  if (!sig.r || !sig.s) return false;
  if (!isValidHex(sig.r) || !isValidHex(sig.s)) return false;

  if (sig.r.length !== 64 || sig.s.length !== 64) return false;

  if (sig.recid !== undefined && (sig.recid < 0 || sig.recid > 3)) return false;

  return true;
}

export function isValidEddsaSignature(sig: string): boolean {
  return isValidHex(sig) && sig.length === 128;
}

export function parseEcdsaSignature(output: string): EcdsaSignature | null {
  try {
    const parsed = JSON.parse(output.trim());
    if (parsed.r && parsed.s) {
      return {
        r: parsed.r,
        s: parsed.s,
        recid: parsed.recid ?? parsed.recovery_id,
      };
    }
  } catch {
    const rMatch = /r\s*[:=]\s*([0-9a-fA-F]+)/i.exec(output);
    const sMatch = /s\s*[:=]\s*([0-9a-fA-F]+)/i.exec(output);
    const recidMatch = /rec(?:overy)?_?id\s*[:=]\s*(\d+)/i.exec(output);

    if (rMatch && sMatch) {
      return {
        r: rMatch[1],
        s: sMatch[1],
        recid: recidMatch ? parseInt(recidMatch[1], 10) : undefined,
      };
    }
  }

  return null;
}

export function isValidDerivationPath(path: string): boolean {
  if (path.startsWith("m/")) {
    return /^m(\/\d+'?)+$/.test(path);
  }

  return /^(\d+)(\/\d+)*$/.test(path);
}

export const ECDSA_TEST_VECTORS = {
  messages: [
    "0000000000000000000000000000000000000000000000000000000000000001",
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    sha256("test message"),
    sha256(""),
  ],

  invalidMessages: ["", "abc", "g123", "0".repeat(63), "0".repeat(65)],
};

export const EDDSA_TEST_VECTORS = {
  messages: [
    "0000000000000000000000000000000000000000000000000000000000000001",
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    sha256("ed25519 test message"),
  ],
};

export function generateThresholdConfigs(): {
  threshold: number;
  parties: number;
}[] {
  return [
    { threshold: 1, parties: 2 },
    { threshold: 1, parties: 3 },
    { threshold: 2, parties: 3 },
    { threshold: 2, parties: 4 },
    { threshold: 3, parties: 5 },
  ];
}

export function generateSessionId(): string {
  return `test-${Date.now()}-${randomHex(4)}`;
}
