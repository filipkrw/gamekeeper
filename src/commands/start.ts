import type { ChatInputCommandInteraction } from "discord.js";
import {
  findServer,
  createServer,
  listSnapshots,
  waitForServerRunning,
} from "../services/hetzner.ts";
import { updateDnsRecord } from "../services/cloudflare.ts";
import { queryServer } from "../services/gamedig.ts";
import { config } from "../config.ts";
import { commandLock } from "../lock.ts";
import { sendToChannel } from "../discord.ts";
import { monitor } from "../monitor.ts";
import { log } from "../logger.ts";

export async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!commandLock.acquire("start")) {
    await interaction.reply(`A \`/${commandLock.getOwner()}\` operation is already in progress.`);
    return;
  }

  try {
    const existing = await findServer();
    if (existing) {
      await interaction.reply("Server is already running.");
      return;
    }

    await interaction.deferReply();

    // Find latest snapshot
    const snapshots = await listSnapshots();
    if (snapshots.length === 0) {
      await interaction.editReply("No snapshots found. Cannot start server.");
      return;
    }

    const latestSnapshot = snapshots[0]!;
    log.info(`Using snapshot`, { id: latestSnapshot.id, created: latestSnapshot.created });

    // Create server
    await interaction.editReply("Creating server from snapshot...");
    const server = await createServer(latestSnapshot.id);

    // Wait for server to be running
    await waitForServerRunning(server.id);
    const ip = server.public_net.ipv4.ip;
    log.info(`Server running`, { ip });

    // Update DNS
    let hostname = config.cloudflare.subdomain;
    try {
      await updateDnsRecord(ip);
    } catch (error) {
      log.error("DNS update failed, using raw IP", { error: String(error) });
      hostname = ip;
      await sendToChannel(`DNS update failed. Connect using IP: \`${ip}\``);
    }

    // Start background monitor
    monitor.start(ip, config.game.queryPort);

    // Wait for game server to be queryable
    await interaction.editReply("Server created. Waiting for game server to start...");
    const ready = await waitForGameReady(ip, config.game.queryPort);

    if (ready) {
      await interaction.editReply(
        `Server is ready! Connect to \`${hostname}\``
      );
    } else {
      await interaction.editReply(
        `Server is running but game may still be starting. Connect to \`${hostname}\``
      );
    }
  } catch (error) {
    log.error("Start command failed", { error: String(error) });
    const msg = `Failed to start server: ${error instanceof Error ? error.message : String(error)}`;
    if (interaction.deferred) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply(msg);
    }
    await sendToChannel(msg);
  } finally {
    commandLock.release();
  }
}

async function waitForGameReady(
  host: string,
  port: number,
  timeoutMs = 300_000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await queryServer(host, port);
    if (status?.online) return true;
    await Bun.sleep(10_000);
  }
  return false;
}
