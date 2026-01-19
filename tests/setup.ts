import { beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export const TEST_ROOT = import.meta.dir;
export const PROJECT_ROOT = join(TEST_ROOT, "..");
export const TEST_ARTIFACTS_DIR = join(TEST_ROOT, ".artifacts");
export const TEST_KEYS_DIR = join(TEST_ARTIFACTS_DIR, "keys");
export const TEST_LOGS_DIR = join(TEST_ARTIFACTS_DIR, "logs");

export const CLI_BINARY = join(PROJECT_ROOT, "target", "release", "tss_cli");
export const CLI_DEBUG_BINARY = join(PROJECT_ROOT, "target", "debug", "tss_cli");

export const DEFAULT_MANAGER_PORT = 18000;
export const DEFAULT_MANAGER_HOST = "127.0.0.1";
export const DEFAULT_MANAGER_URL = `http://${DEFAULT_MANAGER_HOST}:${DEFAULT_MANAGER_PORT}`;

export const TEST_ENV = {
  TSS_LOG_LEVEL: "debug",
  TSS_CLI_POLL_TIMEOUT: "10",
  TSS_CLI_SIGNUP_TIMEOUT: "10",
  TSS_CLI_MANAGER_TTL: "60",
  TSS_MANAGER_MAX_PARTIES: "10",
  ROCKET_ADDRESS: DEFAULT_MANAGER_HOST,
  ROCKET_PORT: String(DEFAULT_MANAGER_PORT),
  ROCKET_LOG_LEVEL: "off",
};

const spawnedProcesses = new Set<{ kill: () => void }>();

export function trackProcess(proc: { kill: () => void }): void {
  spawnedProcesses.add(proc);
}

export function untrackProcess(proc: { kill: () => void }): void {
  spawnedProcesses.delete(proc);
}

beforeAll(() => {
  if (!existsSync(TEST_ARTIFACTS_DIR)) {
    mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });
  }
  if (!existsSync(TEST_KEYS_DIR)) {
    mkdirSync(TEST_KEYS_DIR, { recursive: true });
  }
  if (!existsSync(TEST_LOGS_DIR)) {
    mkdirSync(TEST_LOGS_DIR, { recursive: true });
  }

  console.log("Test setup complete");
  console.log(`  CLI Binary: ${CLI_BINARY}`);
  console.log(`  Artifacts: ${TEST_ARTIFACTS_DIR}`);
});

afterAll(() => {
  let killedCount = 0;
  for (const proc of spawnedProcesses) {
    try {
      proc.kill();
      killedCount++;
    } catch {
      /* Process already terminated */
    }
  }
  spawnedProcesses.clear();
  if (killedCount > 0) {
    console.log(`Cleaned up ${killedCount} process(es)`);
  }
  console.log("Test teardown complete");
});
