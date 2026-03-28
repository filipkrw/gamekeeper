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

describe("/status", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  test("server offline — replies 'Server is offline'", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
    const interaction = mockInteraction("status");

    await handleStatus(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith("Server is offline.");
  });

  test("server online, game queryable — shows players and cost", async () => {
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

    expect(fields.find((f: any) => f.name === "Status").value).toBe("Online");
    expect(fields.find((f: any) => f.name === "Players").value).toBe("2/16");
    expect(fields.find((f: any) => f.name === "Online Players").value).toBe("Alice, Bob");

    // Cost for 2 hours at CCX23 (€0.05/hr) ≈ €0.10
    const costField = fields.find((f: any) => f.name === "Session Cost");
    expect(costField.value).toMatch(/€0\.1/);
  });

  test("server online, game not responding — shows Starting...", async () => {
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(createMockServer()));
    gamedigMocks.queryServer.mockImplementation(() => Promise.resolve(null));

    const interaction = mockInteraction("status");
    await handleStatus(interaction as any);

    const call = interaction.editReply.mock.calls[0]![0] as any;
    const fields = call.embeds[0].data.fields;
    expect(fields.find((f: any) => f.name === "Status").value).toBe("Starting...");
  });

  test("CCX33 cost uses higher rate", async () => {
    const server = createMockServer({
      server_type: { name: "ccx33" },
      created: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour
    });
    hetznerMocks.findServer.mockImplementation(() => Promise.resolve(server));
    gamedigMocks.queryServer.mockImplementation(() =>
      Promise.resolve(createMockGameStatus())
    );

    const interaction = mockInteraction("status");
    await handleStatus(interaction as any);

    const call = interaction.editReply.mock.calls[0]![0] as any;
    const costField = call.embeds[0].data.fields.find((f: any) => f.name === "Session Cost");
    // 1 hour at €0.10/hr = €0.10
    expect(costField.value).toMatch(/€0\.1/);
  });
});
