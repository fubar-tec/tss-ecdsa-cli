import { type Subprocess } from "bun";
import { ofetch, FetchError } from "ofetch";
import { DEFAULT_MANAGER_HOST, DEFAULT_MANAGER_PORT, TEST_ENV } from "../setup";
import { spawnCliProcess, killProcess } from "./cli";

export interface ManagerConfig {
  host?: string;
  port?: number;
  maxParties?: number;
  ttl?: number;
  authKeyPairs?: Record<string, string>;
  logLevel?: "debug" | "normal" | "critical" | "off";
}

export interface ManagerInstance {
  process: Subprocess;
  url: string;
  host: string;
  port: number;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

export async function startManager(config: ManagerConfig = {}): Promise<ManagerInstance> {
  const {
    host = DEFAULT_MANAGER_HOST,
    port = DEFAULT_MANAGER_PORT,
    maxParties = 10,
    ttl = 60,
    authKeyPairs = {},
    logLevel = "off",
  } = config;

  const authPairsStr = Object.entries(authKeyPairs)
    .map(([user, pass]) => `${user}=${pass}`)
    .join(",");

  type TestEnvKeys = keyof typeof TEST_ENV | "TSS_MANAGER_HTTP_AUTH_KEY_PAIRS";

  const env: Partial<Record<TestEnvKeys, string>> = {
    ...TEST_ENV,
    ROCKET_ADDRESS: host,
    ROCKET_PORT: String(port),
    ROCKET_LOG_LEVEL: logLevel,
    TSS_MANAGER_MAX_PARTIES: String(maxParties),
    TSS_CLI_MANAGER_TTL: String(ttl),
  };

  if (authPairsStr) {
    env.TSS_MANAGER_HTTP_AUTH_KEY_PAIRS = authPairsStr;
  }

  const proc = spawnCliProcess(["manager"], { env });

  const url = `http://${host}:${port}`;

  await waitForManagerReady(url);

  const instance: ManagerInstance = {
    process: proc,
    url,
    host,
    port,
    stop: async () => {
      await killProcess(proc);
    },
    isRunning: () => !proc.killed,
  };

  return instance;
}

export async function waitForManagerReady(url: string, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  const healthUrl = `${url}/ping`;

  while (Date.now() - startTime < timeout) {
    try {
      await ofetch(healthUrl);
      return;
    } catch {
      /* Manager not ready yet, retry */
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Manager at ${url} did not become ready within ${timeout}ms`);
}

export async function isManagerHealthy(url: string): Promise<boolean> {
  try {
    await ofetch(`${url}/ping`);
    return true;
  } catch {
    return false;
  }
}

export class ManagerClient {
  private readonly fetcher: typeof ofetch;

  constructor(
    readonly baseUrl: string,
    readonly jwtToken?: string
  ) {
    this.fetcher = ofetch.create({
      baseURL: baseUrl,
      headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    });
  }

  async ping(): Promise<{ status: string }> {
    return this.fetcher("/ping");
  }

  async get(key: string): Promise<{ key: string; value: string } | null> {
    try {
      return await this.fetcher("/get", {
        method: "POST",
        body: { key },
      });
    } catch (error) {
      if (error instanceof FetchError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.fetcher("/set", {
      method: "POST",
      body: { key, value },
    });
  }

  async signup(uuid: string): Promise<{ party_id: number }> {
    return this.fetcher("/signup", {
      method: "POST",
      body: { uuid },
    });
  }

  async signupStatus(uuid: string): Promise<{ party_count: number }> {
    return this.fetcher("/signup_status", {
      method: "POST",
      body: { uuid },
    });
  }

  async store(
    party_from: number,
    party_to: number,
    round: string,
    uuid: string,
    data: string
  ): Promise<void> {
    await this.fetcher("/store", {
      method: "POST",
      body: { party_from, party_to, round, uuid, data },
    });
  }

  async poll(
    party_from: number,
    party_to: number,
    round: string,
    uuid: string
  ): Promise<{ data: string } | null> {
    try {
      return await this.fetcher("/poll", {
        method: "POST",
        body: { party_from, party_to, round, uuid },
      });
    } catch (error) {
      if (error instanceof FetchError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}

export function createManagerClient(url: string, jwtToken?: string): ManagerClient {
  return new ManagerClient(url, jwtToken);
}
