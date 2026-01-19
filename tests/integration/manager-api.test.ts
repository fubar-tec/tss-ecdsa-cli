import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  startManager,
  createManagerClient,
  isManagerHealthy,
  type ManagerInstance,
  type ManagerClient,
} from "../helpers/manager";
import { cliExists } from "../helpers/cli";
import { generateSessionId, randomHex } from "../helpers/crypto";
import { CLI_BINARY } from "../setup";

describe("Manager API", () => {
  let manager: ManagerInstance | undefined;
  let client: ManagerClient | undefined;

  beforeAll(async () => {
    if (!cliExists()) {
      console.warn(`Skipping Manager API tests: CLI binary not found at ${CLI_BINARY}`);
      console.warn("Run 'cargo build --release' first.");
      return;
    }

    const port = 18000 + Math.floor(Math.random() * 1000);
    manager = await startManager({ port });
    client = createManagerClient(manager.url);
  });

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  describe("Health Check", () => {
    test("ping endpoint returns success", async () => {
      if (!client) return;
      const response = await client.ping();
      expect(response).toBeDefined();
    });

    test("isManagerHealthy returns true for running manager", async () => {
      if (!manager) return;
      const healthy = await isManagerHealthy(manager.url);
      expect(healthy).toBe(true);
    });

    test("isManagerHealthy returns false for non-existent manager", async () => {
      const healthy = await isManagerHealthy("http://127.0.0.1:59999");
      expect(healthy).toBe(false);
    });
  });

  describe("Key-Value Storage", () => {
    test("set and get value", async () => {
      if (!client) return;
      const key = `test-key-${randomHex(4)}`;
      const value = "test-value";

      await client.set(key, value);
      const result = await client.get(key);

      expect(result).not.toBeNull();
      expect(result?.value).toBe(value);
    });

    test("get returns null for non-existent key", async () => {
      if (!client) return;
      const result = await client.get(`non-existent-${randomHex(8)}`);
      expect(result).toBeNull();
    });

    test("overwrite existing value", async () => {
      if (!client) return;
      const key = `overwrite-key-${randomHex(4)}`;

      await client.set(key, "value1");
      await client.set(key, "value2");

      const result = await client.get(key);
      expect(result?.value).toBe("value2");
    });
  });

  describe("Party Signup", () => {
    test("signup returns party_id", async () => {
      if (!client) return;
      const uuid = generateSessionId();
      const result = await client.signup(uuid);

      expect(result.party_id).toBeDefined();
      expect(result.party_id).toBeGreaterThanOrEqual(1);
    });

    test("multiple signups get different party IDs", async () => {
      if (!client) return;
      const uuid = generateSessionId();

      const party1 = await client.signup(uuid);
      const party2 = await client.signup(uuid);

      expect(party1.party_id).not.toBe(party2.party_id);
    });

    test("signup status tracks party count", async () => {
      if (!client) return;
      const uuid = generateSessionId();

      await client.signup(uuid);
      const status1 = await client.signupStatus(uuid);
      expect(status1.party_count).toBe(1);

      await client.signup(uuid);
      const status2 = await client.signupStatus(uuid);
      expect(status2.party_count).toBe(2);
    });
  });

  describe("Message Store and Poll", () => {
    test("store and poll message between parties", async () => {
      if (!client) return;
      const uuid = generateSessionId();
      const round = "test-round";
      const data = "encrypted-message-data";

      await client.store(1, 2, round, uuid, data);

      const result = await client.poll(1, 2, round, uuid);

      expect(result).not.toBeNull();
      expect(result?.data).toBe(data);
    });

    test("poll returns null for non-existent message", async () => {
      if (!client) return;
      const uuid = generateSessionId();
      const result = await client.poll(1, 2, "non-existent-round", uuid);

      expect(result).toBeNull();
    });

    test("broadcast to all parties", async () => {
      if (!client) return;
      const uuid = generateSessionId();
      const round = "broadcast-round";
      const data = "broadcast-data";

      await client.store(1, 0, round, uuid, data);

      const result2 = await client.poll(1, 0, round, uuid);
      expect(result2?.data).toBe(data);
    });

    test("point-to-point messaging", async () => {
      if (!client) return;
      const uuid = generateSessionId();
      const round = "p2p-round";

      await client.store(1, 2, round, uuid, "message-for-2");

      await client.store(1, 3, round, uuid, "message-for-3");

      const result2 = await client.poll(1, 2, round, uuid);
      const result3 = await client.poll(1, 3, round, uuid);

      expect(result2?.data).toBe("message-for-2");
      expect(result3?.data).toBe("message-for-3");
    });
  });

  describe("Multiple Rounds", () => {
    test("messages are isolated by round", async () => {
      if (!client) return;
      const uuid = generateSessionId();

      await client.store(1, 2, "round1", uuid, "data-round1");
      await client.store(1, 2, "round2", uuid, "data-round2");

      const result1 = await client.poll(1, 2, "round1", uuid);
      const result2 = await client.poll(1, 2, "round2", uuid);

      expect(result1?.data).toBe("data-round1");
      expect(result2?.data).toBe("data-round2");
    });
  });

  describe("Session Isolation", () => {
    test("messages are isolated by session UUID", async () => {
      if (!client) return;
      const uuid1 = generateSessionId();
      const uuid2 = generateSessionId();
      const round = "test-round";

      await client.store(1, 2, round, uuid1, "data-session1");
      await client.store(1, 2, round, uuid2, "data-session2");

      const result1 = await client.poll(1, 2, round, uuid1);
      const result2 = await client.poll(1, 2, round, uuid2);

      expect(result1?.data).toBe("data-session1");
      expect(result2?.data).toBe("data-session2");
    });
  });
});

describe("Manager Lifecycle", () => {
  test("manager starts and stops cleanly", async () => {
    if (!cliExists()) return;

    const port = 19000 + Math.floor(Math.random() * 1000);
    const mgr = await startManager({ port });

    expect(mgr.isRunning()).toBe(true);
    expect(await isManagerHealthy(mgr.url)).toBe(true);

    await mgr.stop();

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await isManagerHealthy(mgr.url)).toBe(false);
  });

  test("manager respects configuration", async () => {
    if (!cliExists()) return;

    const port = 19100 + Math.floor(Math.random() * 1000);
    const mgr = await startManager({
      port,
      maxParties: 5,
      ttl: 30,
    });

    expect(mgr.port).toBe(port);
    expect(mgr.url).toContain(String(port));

    await mgr.stop();
  });
});
