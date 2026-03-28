import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  mockInteraction,
  resetAllMocks,
  hetznerMocks,
  gamedigMocks,
  channelMessages,
  sendToChannelMock,
  createMockServer,
  createMockSnapshot,
  createMockGameStatus,
} from "./helpers.ts";

// mock.module calls are hoisted to run before any imports
mock.module("../services/hetzner.ts", () => hetznerMocks);
mock.module("../services/cloudflare.ts", () => ({ updateDnsRecord: mock() }));
mock.module("../services/gamedig.ts", () => gamedigMocks);
mock.module("../discord.ts", () => ({
  client: {},
  sendToChannel: sendToChannelMock,
}));

import { handleStop, performStop } from "../commands/stop.ts";
import { commandLock } from "../lock.ts";
import { monitor } from "../monitor.ts";

describe("/stop", () => {
  beforeEach(() => {
    resetAllMocks();
    commandLock.release();
    monitor.stop();
  });

  afterEach(() => {
    commandLock.release();
    monitor.stop();
  });

  test("happy path — snapshots, deletes server, cleans up old snapshots", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    hetznerMocks.listSnapshots.mockImplementation(() =>
      Promise.resolve([
        createMockSnapshot({ id: 1 }),
        createMockSnapshot({ id: 2 }),
        createMockSnapshot({ id: 3 }),
        createMockSnapshot({ id: 4 }), // should be deleted (only keep 3)
      ])
    );

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.createSnapshot).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.waitForAction).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.deleteServer).toHaveBeenCalledWith(12345);
    expect(hetznerMocks.deleteImage).toHaveBeenCalledWith(4); // 4th snapshot deleted

    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("zatrzymany i zapisany");
  });

  test("players online — refuses to stop", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    gamedigMocks.queryServer.mockImplementation(() =>
      Promise.resolve(createMockGameStatus({ playerCount: 2 }))
    );

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(interaction.reply.mock.calls[0]![0] as string).toContain("Nie można zatrzymać");
    expect(hetznerMocks.createSnapshot).not.toHaveBeenCalled();
  });

  test("no server running — replies immediately", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith("Żaden serwer nie jest uruchomiony.");
    expect(hetznerMocks.createSnapshot).not.toHaveBeenCalled();
  });

  test("lock held — replies with owner", async () => {
    commandLock.acquire("start");

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    const msg = interaction.reply.mock.calls[0]![0] as string;
    expect(msg).toContain("start");
  });

  test("snapshot fails once, retry succeeds — server still deleted", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    let attempt = 0;
    hetznerMocks.createSnapshot.mockImplementation(() => {
      attempt++;
      if (attempt === 1) return Promise.reject(new Error("snapshot failed"));
      return Promise.resolve({ imageId: 100, actionId: 200 });
    });

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(hetznerMocks.createSnapshot).toHaveBeenCalledTimes(2);
    expect(hetznerMocks.deleteServer).toHaveBeenCalledTimes(1);
  });

  test("snapshot fails twice — server NOT deleted (data protection)", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    hetznerMocks.createSnapshot.mockImplementation(() =>
      Promise.reject(new Error("snapshot failed"))
    );

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(hetznerMocks.createSnapshot).toHaveBeenCalledTimes(2);
    expect(hetznerMocks.deleteServer).not.toHaveBeenCalled();

    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("zostawiam serwer");
  });

  test("player joins during snapshot — server kept alive, snapshot deleted", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    // No players before stop, but player joins during snapshot
    let queryCount = 0;
    gamedigMocks.queryServer.mockImplementation(() => {
      queryCount++;
      const playerCount = queryCount === 1 ? 0 : 1; // empty before, occupied after
      return Promise.resolve(createMockGameStatus({ playerCount }));
    });

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(hetznerMocks.createSnapshot).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.deleteServer).not.toHaveBeenCalled();
    expect(hetznerMocks.deleteImage).toHaveBeenCalledWith(100); // snapshot imageId from default mock

    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("pozostaje włączony");
  });

  test("player joins during snapshot — monitor keeps running", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    let queryCount = 0;
    gamedigMocks.queryServer.mockImplementation(() => {
      queryCount++;
      const playerCount = queryCount === 1 ? 0 : 1;
      return Promise.resolve(createMockGameStatus({ playerCount }));
    });

    monitor.start("1.2.3.4", 15637);
    expect(monitor.isRunning()).toBe(true);

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(hetznerMocks.deleteServer).not.toHaveBeenCalled();
    expect(monitor.isRunning()).toBe(true);
  });

  test("releases lock after completion", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(commandLock.isLocked()).toBe(false);
  });

  test("releases lock after snapshot failure", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    hetznerMocks.createSnapshot.mockImplementation(() =>
      Promise.reject(new Error("fail"))
    );

    const interaction = mockInteraction("stop");
    await handleStop(interaction as any);

    expect(commandLock.isLocked()).toBe(false);
  });
});

describe("performStop (auto-shutdown variant)", () => {
  beforeEach(() => {
    resetAllMocks();
    monitor.stop();
  });

  afterEach(() => {
    monitor.stop();
  });

  test("sends messages via callback, not interaction", async () => {
    const messages: string[] = [];
    const reply = async (msg: string) => {
      messages.push(msg);
    };

    await performStop(12345, "1.2.3.4", reply);

    expect(hetznerMocks.createSnapshot).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.deleteServer).toHaveBeenCalledWith(12345);
    expect(messages.some((m) => m.includes("zatrzymany i zapisany"))).toBe(true);
  });
});
