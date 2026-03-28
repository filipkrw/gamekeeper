import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  mockInteraction,
  resetAllMocks,
  hetznerMocks,
  gamedigMocks,
  channelMessages,
  sendToChannelMock,
  createMockServer,
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

import { handleStatus } from "../commands/status.ts";
import { msg } from "../messages.ts";

describe("/status", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("server offline — replies 'Server is offline'", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    const interaction = mockInteraction("status");

    await handleStatus(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith(msg.serverOffline);
  });

  test("server online, game queryable — shows players and uptime", async () => {
    const server = createMockServer({
      created: new Date(Date.now() - 7_200_000).toISOString(), // 2 hours ago
    });
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(server));
    gamedigMocks.queryServer.mockImplementation(() =>
      Promise.resolve(createMockGameStatus({ players: ["Alice", "Bob"], playerCount: 2 }))
    );

    const interaction = mockInteraction("status");
    await handleStatus(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    const call = interaction.editReply.mock.calls[0]![0] as any;
    const embed = call.embeds[0];
    const fields = embed.data.fields;

    expect(fields.find((f: any) => f.name === msg.statusFieldStatus).value).toBe(msg.statusOnline);
    expect(fields.find((f: any) => f.name === msg.statusFieldPlayers).value).toBe("2/16");
    expect(fields.find((f: any) => f.name === msg.statusFieldOnlinePlayers).value).toBe("Alice, Bob");
    expect(fields.find((f: any) => f.name === msg.statusFieldUptime).value).toBe("2h 0m");
  });

  test("server online, game not responding — shows Starting...", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));

    const interaction = mockInteraction("status");
    await handleStatus(interaction as any);

    const call = interaction.editReply.mock.calls[0]![0] as any;
    const fields = call.embeds[0].data.fields;
    expect(fields.find((f: any) => f.name === msg.statusFieldStatus).value).toBe(msg.statusStarting);

  });
});
