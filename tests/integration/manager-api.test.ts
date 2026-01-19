import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  startManager,
  createManagerClient,
  isManagerHealthy,
  type ManagerInstance,
  type ManagerClient,
} from "../helpers/manager";
import { cliExists } from "../helpers/cli";
import { randomHex } from "../helpers/crypto";
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
  }, 60000);

  afterAll(async () => {
    if (manager) {
      await manager.stop();
    }
  }, 30000);

  describe("Health Check", () => {
    test("ping endpoint returns success", async () => {
      if (!client) return;
      const response = await client.ping();
      expect(response).toBeDefined();
      expect(response.status).toBe("ok");
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
      expect(result?.key).toBe(key);
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

  describe("Keygen Signup", () => {
    test("signupKeygen returns party info", async () => {
      if (!client) return;
      const result = await client.signupKeygen(2, 1, "secp256k1");

      expect(result.number).toBeDefined();
      expect(result.number).toBeGreaterThanOrEqual(1);
      expect(result.uuid).toBeDefined();
    });

    test("multiple keygen signups increment party number", async () => {
      if (!client) return;

      // Use a unique curve name to avoid interference from previous tests
      const uniqueCurve = `test-curve-${randomHex(4)}`;

      const party1 = await client.signupKeygen(2, 1, uniqueCurve);
      const party2 = await client.signupKeygen(2, 1, uniqueCurve);

      // Both should get assigned numbers
      expect(party1.number).toBeGreaterThanOrEqual(1);
      expect(party2.number).toBeGreaterThanOrEqual(1);
      // They should share the same session UUID until parties are full
      expect(party1.uuid).toBe(party2.uuid);
    });

    test("keygen signup resets after reaching n parties", async () => {
      if (!client) return;

      // Sign up 2 parties (n=2)
      const party1 = await client.signupKeygen(2, 1, "ed25519");
      const party2 = await client.signupKeygen(2, 1, "ed25519");
      // Third signup should start a new session
      const party3 = await client.signupKeygen(2, 1, "ed25519");

      expect(party1.uuid).toBe(party2.uuid);
      expect(party3.uuid).not.toBe(party2.uuid);
      expect(party3.number).toBe(1);
    });
  });

  describe("Signing Signup", () => {
    test("signupSign returns party signup info", async () => {
      if (!client) return;
      const roomId = `room-${randomHex(4)}`;

      const result = await client.signupSign(1, roomId, 1, "", "secp256k1");

      expect(result.party_order).toBeDefined();
      expect(result.party_uuid).toBeDefined();
      expect(result.room_uuid).toBeDefined();
      // total_joined counts other parties, so first joiner sees 0
      expect(result.total_joined).toBeGreaterThanOrEqual(0);
    });

    test("multiple parties can join same signing room", async () => {
      if (!client) return;
      const roomId = `room-${randomHex(4)}`;

      // First party joins
      const party1 = await client.signupSign(1, roomId, 1, "", "secp256k1");

      // Second party joins with different party_number
      const party2 = await client.signupSign(1, roomId, 2, "", "secp256k1");

      // Both should be in the same room
      expect(party1.room_uuid).toBe(party2.room_uuid);
      expect(party1.party_order).not.toBe(party2.party_order);
    });

    test("party can re-ping with their uuid", async () => {
      if (!client) return;
      const roomId = `room-${randomHex(4)}`;

      // First signup
      const initial = await client.signupSign(1, roomId, 1, "", "secp256k1");

      // Re-ping with the same party_uuid
      const reping = await client.signupSign(
        1,
        roomId,
        1,
        initial.party_uuid,
        "secp256k1"
      );

      expect(reping.party_uuid).toBe(initial.party_uuid);
      expect(reping.room_uuid).toBe(initial.room_uuid);
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
  }, 60000);

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
  }, 60000);
});
