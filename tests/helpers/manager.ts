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
  const healthUrl = `${url}/get`;

  while (Date.now() - startTime < timeout) {
    try {
      // Use POST /get with a dummy key - we just want to check if server responds
      await ofetch(healthUrl, {
        method: "POST",
        body: { key: "__health_check__" },
      });
      return;
    } catch (error) {
      // Server returned response (even error) means it's ready
      if (error instanceof FetchError && error.statusCode !== undefined) {
        return;
      }
      /* Manager not ready yet, retry */
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Manager at ${url} did not become ready within ${timeout}ms`);
}

export async function isManagerHealthy(url: string): Promise<boolean> {
  try {
    await ofetch(`${url}/get`, {
      method: "POST",
      body: { key: "__health_check__" },
    });
    return true;
  } catch (error) {
    // Any response from server means it's healthy
    if (error instanceof FetchError && error.statusCode !== undefined) {
      return true;
    }
    return false;
  }
}

// API response types matching Rust Result<T, ManagerError>
interface ApiOkResponse<T> {
  Ok: T;
}

interface ApiErrResponse {
  Err: { error: string };
}

type ApiResponse<T> = ApiOkResponse<T> | ApiErrResponse;

function isOkResponse<T>(response: ApiResponse<T>): response is ApiOkResponse<T> {
  return "Ok" in response;
}

// Data types matching Rust structs
export interface Entry {
  key: string;
  value: string;
}

export interface PartySignup {
  number: number;
  uuid: string;
}

export interface SigningPartySignup {
  party_order: number;
  party_uuid: string;
  room_uuid: string;
  total_joined: number;
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
    // No /ping endpoint, so we use /get with a dummy key to verify server is responding
    try {
      await this.fetcher<ApiResponse<Entry>>("/get", {
        method: "POST",
        body: { key: "__health_check__" },
      });
      return { status: "ok" };
    } catch {
      // Any response from server means it's healthy
      return { status: "ok" };
    }
  }

  async get(key: string): Promise<Entry | null> {
    const response = await this.fetcher<ApiResponse<Entry>>("/get", {
      method: "POST",
      body: { key },
    });

    if (isOkResponse(response)) {
      return response.Ok;
    }
    // Err response means key not found
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    const response = await this.fetcher<ApiResponse<null>>("/set", {
      method: "POST",
      body: { key, value },
    });

    if (!isOkResponse(response)) {
      throw new Error(response.Err.error);
    }
  }

  async signupKeygen(
    parties: number,
    threshold: number,
    curveName: string
  ): Promise<PartySignup> {
    // The endpoint expects a tuple: (Params, String) where Params = { parties: String, threshold: String }
    const response = await this.fetcher<ApiResponse<PartySignup>>("/signupkeygen", {
      method: "POST",
      body: [
        { parties: String(parties), threshold: String(threshold) },
        curveName,
      ],
    });

    if (isOkResponse(response)) {
      return response.Ok;
    }
    throw new Error(response.Err.error);
  }

  async signupSign(
    threshold: number,
    roomId: string,
    partyNumber: number,
    partyUuid: string,
    curveName: string
  ): Promise<SigningPartySignup> {
    const response = await this.fetcher<ApiResponse<SigningPartySignup>>("/signupsign", {
      method: "POST",
      body: {
        threshold,
        room_id: roomId,
        party_number: partyNumber,
        party_uuid: partyUuid,
        curve_name: curveName,
      },
    });

    if (isOkResponse(response)) {
      return response.Ok;
    }
    throw new Error(response.Err.error);
  }
}

export function createManagerClient(url: string, jwtToken?: string): ManagerClient {
  return new ManagerClient(url, jwtToken);
}
