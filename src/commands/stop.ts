import type { ChatInputCommandInteraction } from "discord.js";
import {
  findServer,
  createSnapshot,
  waitForAction,
  deleteServer,
  listSnapshots,
  deleteImage,
} from "../services/hetzner.ts";
import { queryServer } from "../services/gamedig.ts";
import { config } from "../config.ts";
import { commandLock } from "../lock.ts";
import { monitor } from "../monitor.ts";
import { msg } from "../messages.ts";
import { log } from "../logger.ts";

export async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!commandLock.acquire("stop")) {
    await interaction.reply(msg.operationInProgress(commandLock.getOwner()));
    return;
  }

  try {
    const server = await findServer();
    if (!server) {
      await interaction.reply(msg.noServerRunning);
      return;
    }

    const ip = server.public_net.ipv4.ip;
    const gameStatus = await queryServer(ip, config.game.queryPort).catch(() => null);
    if (gameStatus && gameStatus.playerCount > 0) {
      await interaction.reply(msg.playersOnline(gameStatus.playerCount));
      return;
    }

    await interaction.deferReply();
    await performStop(server.id, ip, (m) => interaction.editReply(m));
  } catch (error) {
    log.error("Stop command failed", { error: String(error) });
    const errMsg = msg.stopFailed(error instanceof Error ? error.message : String(error));
    if (interaction.deferred) {
      await interaction.editReply(errMsg);
    } else {
      await interaction.reply(errMsg);
    }
  } finally {
    commandLock.release();
  }
}

/**
 * Core stop logic, reused by auto-shutdown.
 * `reply` is a callback to send progress updates — either interaction.editReply or sendToChannel.
 * Returns true if the server was deleted, false if it was kept alive (player joined during snapshot).
 */
export async function performStop(
  serverId: number,
  serverIp: string,
  reply: (msg: string) => Promise<unknown>
): Promise<boolean> {
  monitor.stop();

  // Snapshot with one retry
  let snapshotResult: { imageId: number; actionId: number } | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await reply(msg.creatingSnapshot);
      snapshotResult = await createSnapshot(serverId);
      await waitForAction(snapshotResult.actionId);
      log.info("Snapshot completed", { imageId: snapshotResult.imageId });
      break;
    } catch (error) {
      log.error(`Snapshot attempt ${attempt} failed`, { error: String(error) });
      if (attempt === 2) {
        await reply(msg.snapshotFailed);
        return false;
      }
    }
  }

  // Check if a player joined during the snapshot
  const gameStatus = await queryServer(serverIp, config.game.queryPort).catch(() => null);
  if (gameStatus && gameStatus.playerCount > 0) {
    await reply(msg.playerJoinedDuringSnapshot);
    return false;
  }

  // Delete server
  await reply(msg.deletingServer);
  await deleteServer(serverId);

  // Clean up old snapshots
  try {
    const snapshots = await listSnapshots();
    const toDelete = snapshots.slice(config.snapshots.maxToKeep);
    for (const snapshot of toDelete) {
      await deleteImage(snapshot.id);
    }
    if (toDelete.length > 0) {
      log.info(`Cleaned up ${toDelete.length} old snapshot(s)`);
    }
  } catch (error) {
    log.warn("Failed to clean up old snapshots", { error: String(error) });
  }

  await reply(msg.serverStopped);
  return true;
}
