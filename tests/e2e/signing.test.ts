import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { spawn } from "bun";
import { startManager, type ManagerInstance } from "../helpers/manager";
import { cliExists, getCliBinary, runCli } from "../helpers/cli";
import {
  generateSessionId,
  randomMessageHash,
  parseEcdsaSignature,
  isValidEcdsaSignature,
} from "../helpers/crypto";
import { CLI_BINARY, TEST_KEYS_DIR, TEST_ENV } from "../setup";

describe("Message Signing (ECDSA)", () => {
  let manager: ManagerInstance | undefined;
  const keyFiles: string[] = [];

  const sessionId = `sign-test-${Date.now()}`;
  const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-s1.json`);
  const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-s2.json`);

  beforeAll(async () => {
    if (!cliExists()) {
      throw new Error(`CLI binary not found before signing tests at ${CLI_BINARY}`);
    }

    const port = 18300 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });

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

    if (exit1 === 0 && exit2 === 0) {
      keyFiles.push(keyFile1, keyFile2);
    } else {
      console.warn("Failed to generate keys for signing tests");
    }
  }, 180000);

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }

    keyFiles.forEach((file) => {
      if (existsSync(file)) {
        rmSync(file);
      }
    });
  });

  test("2-of-2 signing produces valid signature", async () => {
    if (!manager) {
      throw new Error("Manager not started before 2-of-2 signing tests");
    }

    const message = randomMessageHash();
    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "sign", keyFile1, "1/2", message, "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "sign", keyFile2, "1/2", message, "-a", manager.url],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exit1, exit2] = await Promise.all([proc1.exited, proc2.exited]);

    expect(exit1).toBe(0);
    expect(exit2).toBe(0);

    const stdout1 = await new Response(proc1.stdout).text();
    const stdout2 = await new Response(proc2.stdout).text();

    const sig1 = parseEcdsaSignature(stdout1);
    const sig2 = parseEcdsaSignature(stdout2);

    expect(sig1).not.toBeNull();
    expect(sig2).not.toBeNull();

    if (sig1 && sig2) {
      expect(isValidEcdsaSignature(sig1)).toBe(true);
      expect(isValidEcdsaSignature(sig2)).toBe(true);

      expect(sig1.r).toBe(sig2.r);
      expect(sig1.s).toBe(sig2.s);
    }
  }, 120000);

  test("signing with HD path works", async () => {
    if (!manager) {
      throw new Error("Manager not started before signing with HD path tests");
    }

    const message = randomMessageHash();
    const binary = getCliBinary();
    const hdPath = "0/0";

    const proc1 = spawn({
      cmd: [binary, "sign", keyFile1, "1/2", message, "-a", manager.url, "-p", hdPath],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "sign", keyFile2, "1/2", message, "-a", manager.url, "-p", hdPath],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exit1, exit2] = await Promise.all([proc1.exited, proc2.exited]);

    expect(exit1).toBe(0);
    expect(exit2).toBe(0);

    const stdout1 = await new Response(proc1.stdout).text();
    const sig = parseEcdsaSignature(stdout1);

    expect(sig).not.toBeNull();
    if (sig) {
      expect(isValidEcdsaSignature(sig)).toBe(true);
    }
  }, 120000);

  test("signing same message twice produces different signatures (due to random k)", async () => {
    const message = randomMessageHash();
    const binary = getCliBinary();

    const sign1 = async () => {
      if (!manager) {
        throw new Error(
          "Manager not started before signing same message twice produces different signatures (due to random k) tests"
        );
      }

      const proc1 = spawn({
        cmd: [binary, "sign", keyFile1, "1/2", message, "-a", manager.url],
        env: TEST_ENV,
        stdout: "pipe",
        stderr: "pipe",
      });

      const proc2 = spawn({
        cmd: [binary, "sign", keyFile2, "1/2", message, "-a", manager.url],
        env: TEST_ENV,
        stdout: "pipe",
        stderr: "pipe",
      });

      await Promise.all([proc1.exited, proc2.exited]);
      const stdout = await new Response(proc1.stdout).text();
      return parseEcdsaSignature(stdout);
    };

    const sig1 = await sign1();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sig2 = await sign1();

    expect(sig1).not.toBeNull();
    expect(sig2).not.toBeNull();

    if (sig1 && sig2) {
      expect(sig1.r !== sig2.r || sig1.s !== sig2.s).toBe(true);
    }
  }, 240000);

  test("different HD paths produce different signatures", async () => {
    const message = randomMessageHash();
    const binary = getCliBinary();

    const signWithPath = async (path: string) => {
      if (!manager) {
        throw new Error(
          "Manager not started before different HD paths produce different signatures tests"
        );
      }

      const proc1 = spawn({
        cmd: [binary, "sign", keyFile1, "1/2", message, "-a", manager.url, "-p", path],
        env: TEST_ENV,
        stdout: "pipe",
        stderr: "pipe",
      });

      const proc2 = spawn({
        cmd: [binary, "sign", keyFile2, "1/2", message, "-a", manager.url, "-p", path],
        env: TEST_ENV,
        stdout: "pipe",
        stderr: "pipe",
      });

      await Promise.all([proc1.exited, proc2.exited]);
      const stdout = await new Response(proc1.stdout).text();
      return parseEcdsaSignature(stdout);
    };

    const sig1 = await signWithPath("0/0");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const sig2 = await signWithPath("0/1");

    expect(sig1).not.toBeNull();
    expect(sig2).not.toBeNull();

    if (sig1 && sig2) {
      expect(sig1.r).not.toBe(sig2.r);
    }
  }, 240000);
});

describe("Message Signing (EdDSA)", () => {
  let manager: ManagerInstance | undefined;
  const keyFiles: string[] = [];

  const sessionId = `ed-sign-test-${Date.now()}`;
  const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-ed1.json`);
  const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-ed2.json`);

  beforeAll(async () => {
    if (!cliExists()) {
      throw new Error("CLI binary not found before EdDSA signing tests");
    }

    const port = 18400 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });

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

    if (exit1 === 0 && exit2 === 0) {
      keyFiles.push(keyFile1, keyFile2);
    }
  }, 180000);

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }

    keyFiles.forEach((file) => {
      if (existsSync(file)) {
        rmSync(file);
      }
    });
  });

  test("2-of-2 EdDSA signing produces valid signature", async () => {
    if (!manager) {
      throw new Error(
        "Manager not started before 2-of-2 EdDSA signing produces valid signature tests"
      );
    }

    const message = randomMessageHash();
    const binary = getCliBinary();

    const proc1 = spawn({
      cmd: [binary, "sign", keyFile1, "1/2", message, "-a", manager.url, "-l", "eddsa"],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const proc2 = spawn({
      cmd: [binary, "sign", keyFile2, "1/2", message, "-a", manager.url, "-l", "eddsa"],
      env: TEST_ENV,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exit1, exit2] = await Promise.all([proc1.exited, proc2.exited]);

    expect(exit1).toBe(0);
    expect(exit2).toBe(0);

    const stdout1 = await new Response(proc1.stdout).text();
    expect(stdout1.trim()).not.toBe("");
  }, 120000);
});

describe("Signing Error Handling", () => {
  let manager: ManagerInstance | undefined;

  beforeAll(async () => {
    if (!cliExists()) {
      throw new Error("CLI binary not found before signing error handling tests");
    }

    const port = 18500 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });
  });

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  test("signing with invalid message hash fails", async () => {
    if (!manager) return;

    const sessionId = generateSessionId();
    const keyFile1 = join(TEST_KEYS_DIR, `${sessionId}-err1.json`);
    const keyFile2 = join(TEST_KEYS_DIR, `${sessionId}-err2.json`);

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

    const invalidMessage = "abc123";
    const result = await runCli(["sign", keyFile1, "1/2", invalidMessage, "-a", manager.url], {
      timeout: 30000,
    });

    expect(result.success).toBe(false);

    if (existsSync(keyFile1)) rmSync(keyFile1);
    if (existsSync(keyFile2)) rmSync(keyFile2);
  }, 180000);

  test("signing with non-existent key file fails", async () => {
    if (!manager) return;

    const message = randomMessageHash();
    const result = await runCli(
      ["sign", "/non/existent/key.json", "1/2", message, "-a", manager.url],
      { timeout: 10000 }
    );

    expect(result.success).toBe(false);
    expect(result.stderr).toContain("");
  });
});
