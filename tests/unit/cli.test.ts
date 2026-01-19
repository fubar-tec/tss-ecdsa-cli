import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { cliExists, getCliBinary } from "../helpers/cli";
import { CLI_BINARY, CLI_DEBUG_BINARY, PROJECT_ROOT } from "../setup";

describe("CLI Helpers", () => {
  describe("cliExists", () => {
    test("returns correct status for release binary", () => {
      const exists = cliExists(false);
      expect(exists).toBe(existsSync(CLI_BINARY));
    });

    test("returns correct status for debug binary", () => {
      const exists = cliExists(true);
      expect(exists).toBe(existsSync(CLI_DEBUG_BINARY));
    });
  });

  describe("getCliBinary", () => {
    test("returns release binary path by default", () => {
      if (!cliExists()) {
        expect(() => getCliBinary()).toThrow();
        return;
      }

      const binary = getCliBinary();
      expect(binary).toBe(CLI_BINARY);
      expect(existsSync(binary)).toBe(true);
    });

    test("returns debug binary path when requested", () => {
      if (!cliExists(true)) {
        expect(() => getCliBinary(true)).toThrow();
        return;
      }

      const binary = getCliBinary(true);
      expect(binary).toBe(CLI_DEBUG_BINARY);
      expect(existsSync(binary)).toBe(true);
    });

    test("throws error when binary not found", () => {
      if (!cliExists()) {
        expect(() => getCliBinary()).toThrow(/CLI binary not found/);
      }
    });
  });

  describe("Project Structure", () => {
    test("project root contains Cargo.toml", () => {
      expect(existsSync(join(PROJECT_ROOT, "Cargo.toml"))).toBe(true);
    });

    test("project root contains src directory", () => {
      expect(existsSync(join(PROJECT_ROOT, "src"))).toBe(true);
    });

    test("expected directories exist", () => {
      const expectedDirs = ["src", "src/common", "src/protocols"];
      expectedDirs.forEach((dir) => {
        expect(existsSync(join(PROJECT_ROOT, dir))).toBe(true);
      });
    });
  });
});

describe("Test Environment", () => {
  test("TEST_ROOT is correctly set", () => {
    expect(existsSync(join(PROJECT_ROOT, "tests"))).toBe(true);
  });

  test("Bun test runner is available", () => {
    expect(typeof describe).toBe("function");
    expect(typeof test).toBe("function");
    expect(typeof expect).toBe("function");
  });

  test("Node.js fs module is available", () => {
    expect(typeof existsSync).toBe("function");
  });
});
