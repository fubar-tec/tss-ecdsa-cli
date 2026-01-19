import { spawn, type Subprocess } from "bun";
import { existsSync } from "node:fs";
import { CLI_BINARY, CLI_DEBUG_BINARY, TEST_ENV, trackProcess, untrackProcess } from "../setup";

export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface CLIOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  debug?: boolean;
}

export function getCliBinary(debug = false): string {
  const binary = debug ? CLI_DEBUG_BINARY : CLI_BINARY;

  if (!existsSync(binary)) {
    throw new Error(
      `CLI binary not found at ${binary}. Run 'cargo build ${debug ? "" : "--release"}' first.`
    );
  }

  return binary;
}

export function cliExists(debug = false): boolean {
  const binary = debug ? CLI_DEBUG_BINARY : CLI_BINARY;
  return existsSync(binary);
}

export async function runCli(args: string[], options: CLIOptions = {}): Promise<CLIResult> {
  const { cwd, env = {}, timeout = 60000, debug = false } = options;

  const binary = getCliBinary(debug);

  const proc = spawn({
    cmd: [binary, ...args],
    cwd,
    env: { ...TEST_ENV, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  trackProcess(proc);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const result = await Promise.race([proc.exited, timeoutPromise]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return {
      exitCode: result,
      stdout,
      stderr,
      success: result === 0,
    };
  } finally {
    untrackProcess(proc);
  }
}

export function spawnCliProcess(args: string[], options: CLIOptions = {}): Subprocess {
  const { cwd, env = {}, debug = false } = options;

  const binary = getCliBinary(debug);

  const proc = spawn({
    cmd: [binary, ...args],
    cwd,
    env: { ...TEST_ENV, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  trackProcess(proc);

  return proc;
}

export async function killProcess(
  proc: Subprocess,
  signal: NodeJS.Signals = "SIGTERM"
): Promise<void> {
  proc.kill(signal as unknown as number);
  untrackProcess(proc);

  await Promise.race([proc.exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
}

export async function waitForOutput(
  proc: Subprocess,
  pattern: string | RegExp,
  timeout = 30000
): Promise<string> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (typeof pattern === "string") {
      if (buffer.includes(pattern)) {
        reader.releaseLock();
        return buffer;
      }
    } else if (pattern.test(buffer)) {
      reader.releaseLock();
      return buffer;
    }
  }

  reader.releaseLock();
  throw new Error(`Timeout waiting for output pattern: ${pattern}`);
}

export async function keygen(
  keyFile: string,
  options: CLIOptions & {
    managerUrl?: string;
    algorithm?: "ecdsa" | "eddsa";
    jwtKey?: string;
    jwtSecret?: string;
  } = {}
): Promise<CLIResult> {
  const { managerUrl, algorithm, jwtKey, jwtSecret, ...cliOptions } = options;

  const args = ["keygen", keyFile, "1/2"];

  if (managerUrl) {
    args.push("-a", managerUrl);
  }
  if (algorithm) {
    args.push("-l", algorithm);
  }
  if (jwtKey) {
    args.push("-k", jwtKey);
  }
  if (jwtSecret) {
    args.push("-s", jwtSecret);
  }

  return runCli(args, cliOptions);
}

export async function pubkey(
  keyFile: string,
  options: CLIOptions & {
    path?: string;
  } = {}
): Promise<CLIResult> {
  const { path, ...cliOptions } = options;

  const args = ["pubkey", keyFile];

  if (path) {
    args.push("-p", path);
  }

  return runCli(args, cliOptions);
}

export async function sign(
  keyFile: string,
  message: string,
  options: CLIOptions & {
    managerUrl?: string;
    path?: string;
    algorithm?: "ecdsa" | "eddsa";
    jwtKey?: string;
    jwtSecret?: string;
  } = {}
): Promise<CLIResult> {
  const { managerUrl, path, algorithm, jwtKey, jwtSecret, ...cliOptions } = options;

  const args = ["sign", keyFile, "1/2", message];

  if (managerUrl) {
    args.push("-a", managerUrl);
  }
  if (path) {
    args.push("-p", path);
  }
  if (algorithm) {
    args.push("-l", algorithm);
  }
  if (jwtKey) {
    args.push("-k", jwtKey);
  }
  if (jwtSecret) {
    args.push("-s", jwtSecret);
  }

  return runCli(args, cliOptions);
}

export async function safetyCheck(keyFile: string, options: CLIOptions = {}): Promise<CLIResult> {
  return runCli(["safety_check", keyFile], options);
}
