import type { ChatInputCommandInteraction } from "discord.js";
import {
  findServer,
  createServer,
  listSnapshots,
} from "../services/hetzner.ts";
import { updateDnsRecord } from "../services/cloudflare.ts";
import { queryServer } from "../services/gamedig.ts";
import { config } from "../config.ts";
import { commandLock } from "../lock.ts";
import { sendToChannel } from "../discord.ts";
import { monitor } from "../monitor.ts";
import { msg } from "../messages.ts";
import { log } from "../logger.ts";

export async function handleStart(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!commandLock.acquire("start")) {
    await interaction.reply(msg.operationInProgress(commandLock.getOwner()));
    return;
  }

  try {
    const existing = await findServer();
    if (existing) {
      await interaction.reply(msg.serverAlreadyRunning);
      return;
    }

    await interaction.deferReply();

    // Find latest snapshot
    const snapshots = await listSnapshots();
    if (snapshots.length === 0) {
      await interaction.editReply(msg.noSnapshotsFound);
      return;
    }

    const latestSnapshot = snapshots[0]!;
    log.info(`Using snapshot`, {
      id: latestSnapshot.id,
      created: latestSnapshot.created,
    });

    // Create server
    await interaction.editReply(msg.creatingServer);
    const server = await createServer(latestSnapshot.id);
    const ip = server.public_net.ipv4.ip;

    // Update DNS immediately (don't wait for running state)
    let hostname = config.cloudflare.domain;
    try {
      await updateDnsRecord(ip);
    } catch (error) {
      log.error("DNS update failed, using raw IP", { error: String(error) });
      hostname = ip;
      await sendToChannel(msg.dnsUpdateFailed(ip));
    }

    // Start background monitor
    monitor.start(ip, config.game.queryPort);

    // Wait for game server to be queryable
    await interaction.editReply(msg.waitingForGame);
    await waitForGameReady(ip, config.game.queryPort, config.game.serverReadyTimeoutMs);
    await interaction.editReply(msg.serverReady(hostname));
  } catch (error) {
    log.error("Start command failed", { error: String(error) });
    const errorMsg = msg.startFailed(
      error instanceof Error ? error.message : String(error),
    );
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply(errorMsg);
    }
    await sendToChannel(errorMsg);
  } finally {
    commandLock.release();
  }
}

async function waitForGameReady(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await queryServer(host, port);
    if (status?.online) {
      log.info("Game server ready", { host, port });
      return;
    }
    await Bun.sleep(10_000);
  }
}
