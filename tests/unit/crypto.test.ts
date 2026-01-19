import { describe, test, expect } from "bun:test";
import {
  randomHex,
  randomMessageHash,
  sha256,
  isValidHex,
  isValidMessageHash,
  isValidEcdsaPublicKey,
  isValidEddsaPublicKey,
  isValidEcdsaSignature,
  isValidEddsaSignature,
  parseEcdsaSignature,
  isValidDerivationPath,
  ECDSA_TEST_VECTORS,
  generateThresholdConfigs,
  generateSessionId,
} from "../helpers/crypto";

describe("Crypto Helpers", () => {
  describe("randomHex", () => {
    test("generates correct length hex string", () => {
      expect(randomHex(16)).toHaveLength(32);
      expect(randomHex(32)).toHaveLength(64);
      expect(randomHex(1)).toHaveLength(2);
    });

    test("generates valid hex characters", () => {
      const hex = randomHex(32);
      expect(isValidHex(hex)).toBe(true);
    });

    test("generates different values on each call", () => {
      const a = randomHex(32);
      const b = randomHex(32);
      expect(a).not.toBe(b);
    });
  });

  describe("randomMessageHash", () => {
    test("generates 32-byte hash (64 hex chars)", () => {
      const hash = randomMessageHash();
      expect(hash).toHaveLength(64);
      expect(isValidMessageHash(hash)).toBe(true);
    });
  });

  describe("sha256", () => {
    test("computes correct hash for string input", () => {
      const hash = sha256("hello");
      expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    });

    test("computes correct hash for empty string", () => {
      const hash = sha256("");
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    test("computes correct hash for buffer input", () => {
      const buffer = Buffer.from("hello");
      const hash = sha256(buffer);
      expect(hash).toBe(sha256("hello"));
    });
  });

  describe("isValidHex", () => {
    test("accepts valid hex strings", () => {
      expect(isValidHex("0123456789abcdef")).toBe(true);
      expect(isValidHex("ABCDEF")).toBe(true);
      expect(isValidHex("0")).toBe(true);
    });

    test("rejects invalid hex strings", () => {
      expect(isValidHex("")).toBe(false);
      expect(isValidHex("xyz")).toBe(false);
      expect(isValidHex("0x1234")).toBe(false);
      expect(isValidHex("12 34")).toBe(false);
    });
  });

  describe("isValidMessageHash", () => {
    test("accepts valid 32-byte message hashes", () => {
      expect(isValidMessageHash("0".repeat(64))).toBe(true);
      expect(isValidMessageHash("f".repeat(64))).toBe(true);
      expect(isValidMessageHash(randomMessageHash())).toBe(true);
    });

    test("rejects invalid message hashes", () => {
      ECDSA_TEST_VECTORS.invalidMessages.forEach((msg) => {
        expect(isValidMessageHash(msg)).toBe(false);
      });
    });
  });

  describe("isValidEcdsaPublicKey", () => {
    test("accepts valid compressed public keys", () => {
      const compressed02 = "02" + "a".repeat(64);
      const compressed03 = "03" + "b".repeat(64);
      expect(isValidEcdsaPublicKey(compressed02)).toBe(true);
      expect(isValidEcdsaPublicKey(compressed03)).toBe(true);
    });

    test("accepts valid uncompressed public keys", () => {
      const uncompressed = "04" + "c".repeat(128);
      expect(isValidEcdsaPublicKey(uncompressed)).toBe(true);
    });

    test("rejects invalid public keys", () => {
      expect(isValidEcdsaPublicKey("")).toBe(false);
      expect(isValidEcdsaPublicKey("01" + "a".repeat(64))).toBe(false);
      expect(isValidEcdsaPublicKey("02" + "a".repeat(62))).toBe(false);
      expect(isValidEcdsaPublicKey("04" + "a".repeat(126))).toBe(false);
    });
  });

  describe("isValidEddsaPublicKey", () => {
    test("accepts valid 32-byte public keys", () => {
      const pubkey = "a".repeat(64);
      expect(isValidEddsaPublicKey(pubkey)).toBe(true);
    });

    test("rejects invalid public keys", () => {
      expect(isValidEddsaPublicKey("")).toBe(false);
      expect(isValidEddsaPublicKey("a".repeat(63))).toBe(false);
      expect(isValidEddsaPublicKey("a".repeat(65))).toBe(false);
      expect(isValidEddsaPublicKey("g".repeat(64))).toBe(false);
    });
  });

  describe("isValidEcdsaSignature", () => {
    test("accepts valid signatures", () => {
      expect(
        isValidEcdsaSignature({
          r: "a".repeat(64),
          s: "b".repeat(64),
        })
      ).toBe(true);

      expect(
        isValidEcdsaSignature({
          r: "a".repeat(64),
          s: "b".repeat(64),
          recid: 0,
        })
      ).toBe(true);

      expect(
        isValidEcdsaSignature({
          r: "a".repeat(64),
          s: "b".repeat(64),
          recid: 3,
        })
      ).toBe(true);
    });

    test("rejects invalid signatures", () => {
      expect(isValidEcdsaSignature({ r: "", s: "" })).toBe(false);
      expect(
        isValidEcdsaSignature({
          r: "a".repeat(63),
          s: "b".repeat(64),
        })
      ).toBe(false);
      expect(
        isValidEcdsaSignature({
          r: "a".repeat(64),
          s: "b".repeat(64),
          recid: 4,
        })
      ).toBe(false);
    });
  });

  describe("isValidEddsaSignature", () => {
    test("accepts valid 64-byte signatures", () => {
      expect(isValidEddsaSignature("a".repeat(128))).toBe(true);
    });

    test("rejects invalid signatures", () => {
      expect(isValidEddsaSignature("")).toBe(false);
      expect(isValidEddsaSignature("a".repeat(127))).toBe(false);
      expect(isValidEddsaSignature("a".repeat(129))).toBe(false);
    });
  });

  describe("parseEcdsaSignature", () => {
    test("parses JSON format", () => {
      const json = JSON.stringify({
        r: "a".repeat(64),
        s: "b".repeat(64),
        recid: 1,
      });
      const sig = parseEcdsaSignature(json);
      expect(sig).not.toBeNull();
      expect(sig?.r).toBe("a".repeat(64));
      expect(sig?.s).toBe("b".repeat(64));
      expect(sig?.recid).toBe(1);
    });

    test("parses formatted output", () => {
      const output = `r: ${"a".repeat(64)}\ns: ${"b".repeat(64)}\nrecid: 2`;
      const sig = parseEcdsaSignature(output);
      expect(sig).not.toBeNull();
      expect(sig?.r).toBe("a".repeat(64));
      expect(sig?.recid).toBe(2);
    });

    test("returns null for invalid output", () => {
      expect(parseEcdsaSignature("invalid")).toBeNull();
      expect(parseEcdsaSignature("{}")).toBeNull();
    });
  });

  describe("isValidDerivationPath", () => {
    test("accepts simple numeric paths", () => {
      expect(isValidDerivationPath("0")).toBe(true);
      expect(isValidDerivationPath("0/1")).toBe(true);
      expect(isValidDerivationPath("0/1/2")).toBe(true);
      expect(isValidDerivationPath("44/0/0/0/0")).toBe(true);
    });

    test("accepts BIP44 style paths", () => {
      expect(isValidDerivationPath("m/44'/0'/0'/0/0")).toBe(true);
      expect(isValidDerivationPath("m/0")).toBe(true);
      expect(isValidDerivationPath("m/0'")).toBe(true);
    });

    test("rejects invalid paths", () => {
      expect(isValidDerivationPath("")).toBe(false);
      expect(isValidDerivationPath("/0")).toBe(false);
      expect(isValidDerivationPath("0/")).toBe(false);
      expect(isValidDerivationPath("a/b")).toBe(false);
    });
  });

  describe("generateThresholdConfigs", () => {
    test("generates valid threshold configurations", () => {
      const configs = generateThresholdConfigs();
      expect(configs.length).toBeGreaterThan(0);

      configs.forEach((config) => {
        expect(config.threshold).toBeGreaterThanOrEqual(1);
        expect(config.parties).toBeGreaterThan(config.threshold);
      });
    });
  });

  describe("generateSessionId", () => {
    test("generates unique session IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-\d+-[0-9a-f]+$/);
    });
  });
});
