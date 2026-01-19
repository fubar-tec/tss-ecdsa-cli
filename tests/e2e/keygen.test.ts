import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { spawn } from "bun";
import { startManager, type ManagerInstance } from "../helpers/manager";
import { cliExists, getCliBinary, runCli } from "../helpers/cli";
import { generateSessionId } from "../helpers/crypto";
import type { EcdsaKeyFile, EddsaKeyFile } from "../helpers/types";
import { CLI_BINARY, TEST_KEYS_DIR, TEST_ENV } from "../setup";

describe("Key Generation (ECDSA)", () => {
  let manager: ManagerInstance | undefined;
  let keyFiles: string[] = [];

  beforeAll(async () => {
    if (!cliExists()) {
      console.warn(`Skipping keygen tests: CLI binary not found at ${CLI_BINARY}`);
      return;
    }

    const port = 18100 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });
  });

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  afterEach(() => {
    keyFiles.forEach((file) => {
      if (existsSync(file)) {
        rmSync(file);
      }
    });
    keyFiles = [];
  });

  test("2-of-2 keygen generates valid key files", async () => {
    if (!manager) return;

    const sessionId = generateSessionId();
    const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-party1.json`);
    const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-party2.json`);
    keyFiles.push(keyFile1, keyFile2);

    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "keygen", keyFile1, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "keygen", keyFile2, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exit1, exit2] = await Promise.all([proc1.exited, proc2.exited]);

    expect(exit1).toBe(0);
    expect(exit2).toBe(0);

    expect(existsSync(keyFile1)).toBe(true);
    expect(existsSync(keyFile2)).toBe(true);

    const key1 = JSON.parse(readFileSync(keyFile1, "utf-8")) as EcdsaKeyFile;
    const key2 = JSON.parse(readFileSync(keyFile2, "utf-8")) as EcdsaKeyFile;

    expect(key1.party_keys).toBeDefined();
    expect(key1.shared_keys).toBeDefined();
    expect(key1.chain_code).toBeDefined();
    expect(key1.vss_scheme).toBeDefined();
    expect(key1.paillier_key_vec).toBeDefined();

    expect(key2.party_keys).toBeDefined();
    expect(key2.shared_keys).toBeDefined();

    expect(key1.vss_scheme.parameters.threshold).toBe(1);
    expect(key1.vss_scheme.parameters.share_count).toBe(2);

    expect(key1.party_keys.party_index).not.toBe(key2.party_keys.party_index);

    expect(key1.shared_keys.y).toEqual(key2.shared_keys.y);
  }, 120000);

  test("pubkey command returns correct public key", async () => {
    if (!manager) return;

    const sessionId = generateSessionId();
    const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-pub1.json`);
    const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-pub2.json`);
    keyFiles.push(keyFile1, keyFile2);

    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "keygen", keyFile1, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "keygen", keyFile2, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    await Promise.all([proc1.exited, proc2.exited]);

    const result1 = await runCli(["pubkey", keyFile1]);
    const result2 = await runCli(["pubkey", keyFile2]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    expect(result1.stdout.trim()).toBe(result2.stdout.trim());

    const pubkey = result1.stdout.trim();
    expect(pubkey).toMatch(/^[0-9a-fA-F]+$/);
  }, 120000);

  test("pubkey with HD path returns derived key", async () => {
    if (!manager) return;

    const sessionId = generateSessionId();
    const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-hd1.json`);
    const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-hd2.json`);
    keyFiles.push(keyFile1, keyFile2);

    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "keygen", keyFile1, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "keygen", keyFile2, "1/2", "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    await Promise.all([proc1.exited, proc2.exited]);

    const rootResult = await runCli(["pubkey", keyFile1]);

    const derivedResult = await runCli(["pubkey", keyFile1, "-p", "0/0"]);

    expect(rootResult.success).toBe(true);
    expect(derivedResult.success).toBe(true);

    expect(rootResult.stdout.trim()).not.toBe(derivedResult.stdout.trim());

    const derived2 = await runCli(["pubkey", keyFile2, "-p", "0/0"]);
    expect(derivedResult.stdout.trim()).toBe(derived2.stdout.trim());
  }, 120000);
});

describe("Key Generation (EdDSA)", () => {
  let manager: ManagerInstance | undefined;
  let keyFiles: string[] = [];

  beforeAll(async () => {
    if (!cliExists()) {
      console.warn("Skipping EdDSA keygen tests: CLI binary not found");
      return;
    }

    const port = 18200 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });
  });

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  afterEach(() => {
    keyFiles.forEach((file) => {
      if (existsSync(file)) {
        rmSync(file);
      }
    });
    keyFiles = [];
  });

  test("2-of-2 EdDSA keygen generates valid key files", async () => {
    if (!manager) return;

    const sessionId = generateSessionId();
    const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-ed1.json`);
    const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-ed2.json`);
    keyFiles.push(keyFile1, keyFile2);

    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "keygen", keyFile1, "1/2", "-a", manager.url, "-l", "eddsa"],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "keygen", keyFile2, "1/2", "-a", manager.url, "-l", "eddsa"],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exit1, exit2] = await Promise.all([proc1.exited, proc2.exited]);

    expect(exit1).toBe(0);
    expect(exit2).toBe(0);

    expect(existsSync(keyFile1)).toBe(true);
    expect(existsSync(keyFile2)).toBe(true);

    const key1 = JSON.parse(readFileSync(keyFile1, "utf-8")) as EddsaKeyFile;
    const key2 = JSON.parse(readFileSync(keyFile2, "utf-8")) as EddsaKeyFile;

    expect(key1.party_keys).toBeDefined();
    expect(key1.shared_keys).toBeDefined();

    expect((key1 as unknown as EcdsaKeyFile).paillier_key_vec).toBeUndefined();

    expect(key1.shared_keys.y).toEqual(key2.shared_keys.y);
  }, 120000);
});
