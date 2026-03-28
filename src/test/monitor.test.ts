import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  resetAllMocks,
  gamedigMocks,
  hetznerMocks,
  channelMessages,
  sendToChannelMock,
  createMockServer,
  createMockGameStatus,
  createMockSnapshot,
} from "./helpers.ts";

// mock.module calls are hoisted to run before any imports
mock.module("../services/hetzner.ts", () => hetznerMocks);
mock.module("../services/cloudflare.ts", () => ({ updateDnsRecord: mock() }));
mock.module("../services/gamedig.ts", () => gamedigMocks);
mock.module("../discord.ts", () => ({
  client: {},
  sendToChannel: sendToChannelMock,
}));

import { monitor } from "../monitor.ts";
import { commandLock } from "../lock.ts";

// Access private poll method for controlled testing
const poll = () => (monitor as any).poll();
const getState = () => ({
  idleCount: (monitor as any).idleCount as number,
  failCount: (monitor as any).failCount as number,
  isShuttingDown: (monitor as any).isShuttingDown as boolean,
  previousPlayers: (monitor as any).previousPlayers as Set<string>,
});

describe("Monitor", () => {
  beforeEach(() => {
    resetAllMocks();
    commandLock.release();
    monitor.stop();
    // Set host/port so poll() works without start()
    (monitor as any).host = "1.2.3.4";
    (monitor as any).port = 15637;
  });

  afterEach(() => {
    monitor.stop();
    commandLock.release();
  });

  describe("player notifications", () => {
    test("detects player join by name", async () => {
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: ["Alice"], playerCount: 1 }))
      );

      await poll();

      expect(channelMessages).toHaveLength(1);
      expect(channelMessages[0]).toContain("Alice");
      expect(channelMessages[0]).toContain("joined");
    });

    test("detects player leave by name", async () => {
      // First poll: Alice is online
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: ["Alice"], playerCount: 1 }))
      );
      await poll();
      channelMessages.length = 0;

      // Second poll: Alice is gone
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );
      await poll();

      expect(channelMessages).toHaveLength(1);
      expect(channelMessages[0]).toContain("Alice");
      expect(channelMessages[0]).toContain("left");
    });

    test("batches multiple joins into one message", async () => {
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(
          createMockGameStatus({ players: ["Alice", "Bob", "Charlie"], playerCount: 3 })
        )
      );

      await poll();

      expect(channelMessages).toHaveLength(1);
      expect(channelMessages[0]).toContain("Alice");
      expect(channelMessages[0]).toContain("Bob");
      expect(channelMessages[0]).toContain("Charlie");
    });

    test("uses count-based fallback when no names available", async () => {
      // First poll: 0 players
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );
      await poll();
      channelMessages.length = 0;

      // Second poll: 2 players, no names
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 2 }))
      );
      await poll();

      expect(channelMessages).toHaveLength(1);
      expect(channelMessages[0]).toContain("2 players");
      expect(channelMessages[0]).toContain("joined");
    });
  });

  describe("idle shutdown", () => {
    test("increments idle count when 0 players", async () => {
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );

      await poll();
      expect(getState().idleCount).toBe(1);

      await poll();
      expect(getState().idleCount).toBe(2);
    });

    test("resets idle count when players present", async () => {
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );
      await poll();
      await poll();
      expect(getState().idleCount).toBe(2);

      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: ["Alice"], playerCount: 1 }))
      );
      await poll();
      expect(getState().idleCount).toBe(0);
    });

    test("posts warning after threshold reached", async () => {
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );

      // thresholdChecks is set to 3 in test config
      await poll(); // 1
      await poll(); // 2
      channelMessages.length = 0;

      await poll(); // 3 — triggers warning

      expect(channelMessages.some((m) => m.includes("Shutting down"))).toBe(true);
      expect(getState().isShuttingDown).toBe(true);
    });

    test("grace period — player joins cancels shutdown", async () => {
      // Capture the setTimeout callback
      const originalSetTimeout = globalThis.setTimeout;
      let graceCallback: (() => void) | null = null;
      globalThis.setTimeout = ((fn: () => void) => {
        graceCallback = fn;
        return 0 as any;
      }) as typeof globalThis.setTimeout;

      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );

      // Trigger shutdown warning
      for (let i = 0; i < 3; i++) await poll();
      expect(getState().isShuttingDown).toBe(true);

      // Player joins before grace period expires
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: ["Alice"], playerCount: 1 }))
      );
      await poll();
      expect(getState().isShuttingDown).toBe(false);

      // Grace period callback fires but should be a no-op
      channelMessages.length = 0;
      if (graceCallback) await graceCallback();
      expect(hetznerMocks.deleteServer).not.toHaveBeenCalled();

      globalThis.setTimeout = originalSetTimeout;
    });

    test("grace period expires — triggers auto-stop", async () => {
      const originalSetTimeout = globalThis.setTimeout;
      let graceCallback: (() => void) | null = null;
      globalThis.setTimeout = ((fn: () => void) => {
        graceCallback = fn;
        return 0 as any;
      }) as typeof globalThis.setTimeout;

      hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
      );

      // Trigger shutdown warning
      for (let i = 0; i < 3; i++) await poll();

      // Grace period expires, still no players
      if (graceCallback) await graceCallback();

      expect(hetznerMocks.createSnapshot).toHaveBeenCalled();
      expect(hetznerMocks.deleteServer).toHaveBeenCalled();

      globalThis.setTimeout = originalSetTimeout;
    });
  });

  describe("query failures", () => {
    test("increments fail count on query failure", async () => {
      gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));

      await poll();
      expect(getState().failCount).toBe(1);
    });

    test("resets fail count on success", async () => {
      gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));
      await poll();
      await poll();
      expect(getState().failCount).toBe(2);

      gamedigMocks.queryServer.mockImplementation(() =>
        Promise.resolve(createMockGameStatus())
      );
      await poll();
      expect(getState().failCount).toBe(0);
    });

    test("100 consecutive failures triggers auto-shutdown", async () => {
      hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
      gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));

      for (let i = 0; i < 100; i++) await poll();

      expect(channelMessages.some((m) => m.includes("unreachable"))).toBe(true);
      expect(hetznerMocks.createSnapshot).toHaveBeenCalled();
    });
  });

  describe("auto-stop lock contention", () => {
    test("does not stop when lock held by another command", async () => {
      commandLock.acquire("start");
      hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
      gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));

      // Trigger 100 failures to force auto-stop
      for (let i = 0; i < 100; i++) await poll();

      // Should not have attempted snapshot because lock was held
      expect(hetznerMocks.createSnapshot).not.toHaveBeenCalled();
    });
  });
});
