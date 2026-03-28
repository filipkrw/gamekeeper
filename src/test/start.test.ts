import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  mockInteraction,
  resetAllMocks,
  hetznerMocks,
  cloudflareMocks,
  gamedigMocks,
  channelMessages,
  sendToChannelMock,
  createMockServer,
  createMockSnapshot,
} from "./helpers.ts";

// mock.module calls are hoisted to run before any imports
mock.module("../services/hetzner.ts", () => hetznerMocks);
mock.module("../services/cloudflare.ts", () => cloudflareMocks);
mock.module("../services/gamedig.ts", () => gamedigMocks);
mock.module("../discord.ts", () => ({
  client: {},
  sendToChannel: sendToChannelMock,
}));

import { handleStart } from "../commands/start.ts";
import { commandLock } from "../lock.ts";
import { monitor } from "../monitor.ts";

describe("/start", () => {
  beforeEach(() => {
    resetAllMocks();
    commandLock.release();
    monitor.stop();
  });

  afterEach(() => {
    commandLock.release();
    monitor.stop();
  });

  test("happy path — creates server, updates DNS, replies with connection info", async () => {
    const server = createMockServer();
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    hetznerMocks.createServer.mockImplementation(() => Promise.resolve(server));
    hetznerMocks.listSnapshots.mockImplementation(() =>
      Promise.resolve([createMockSnapshot()])
    );
    gamedigMocks.queryServer.mockImplementation(() =>
      Promise.resolve({ online: true, players: [], playerCount: 0, maxPlayers: 16 })
    );

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(hetznerMocks.createServer).toHaveBeenCalledTimes(1);
    expect(cloudflareMocks.updateDnsRecord).toHaveBeenCalledWith("1.2.3.4");
    expect(hetznerMocks.waitForServerRunning).not.toHaveBeenCalled();

    // Final reply contains connection info
    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("gotowy");
    expect(lastReply).toContain("game.example.com");
  });

  test("server already exists — replies immediately, no creation", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith("Serwer już działa.");
    expect(hetznerMocks.createServer).not.toHaveBeenCalled();
  });

  test("lock held — replies with owner command", async () => {
    commandLock.acquire("stop");

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const msg = interaction.reply.mock.calls[0]![0] as string;
    expect(msg).toContain("stop");
    expect(hetznerMocks.findServer).not.toHaveBeenCalled();
  });

  test("no snapshots — replies with error", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    hetznerMocks.listSnapshots.mockImplementation(() => Promise.resolve([]));

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("zapisu serwera");
  });

  test("DNS failure — falls back to raw IP", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    hetznerMocks.createServer.mockImplementation(() => Promise.resolve(createMockServer()));
    cloudflareMocks.updateDnsRecord.mockImplementation(() =>
      Promise.reject(new Error("Cloudflare error"))
    );

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    // Should have sent raw IP to channel
    expect(channelMessages.some((m) => m.includes("1.2.3.4"))).toBe(true);

    // Final reply should use raw IP
    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("1.2.3.4");
  });

  test("server creation throws — posts error to Discord", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    hetznerMocks.createServer.mockImplementation(() =>
      Promise.reject(new Error("Hetzner create failed"))
    );

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    const lastReply = interaction.editReply.mock.calls.at(-1)![0] as string;
    expect(lastReply).toContain("Nie udało się uruchomić");
    expect(channelMessages.some((m) => m.includes("Nie udało się uruchomić"))).toBe(true);
  });

  test("releases lock after completion", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    expect(commandLock.isLocked()).toBe(false);
  });

  test("releases lock after error", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    hetznerMocks.createServer.mockImplementation(() =>
      Promise.reject(new Error("boom"))
    );

    const interaction = mockInteraction("start");
    await handleStart(interaction as any);

    expect(commandLock.isLocked()).toBe(false);
  });
});
