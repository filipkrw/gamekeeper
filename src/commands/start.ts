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
import { aiEnhance } from "../ai.ts";

export async function handleStart(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!commandLock.acquire("start")) {
    await interaction.reply(await aiEnhance(msg.operationInProgress(commandLock.getOwner())));
    return;
  }

  try {
    const existing = await findServer();
    if (existing) {
      await interaction.reply(await aiEnhance(msg.serverAlreadyRunning));
      return;
    }

    await interaction.deferReply();
    await performStart((m) => interaction.editReply(m));
  } catch (error) {
    log.error("Start command failed", { error: String(error) });
    const errorMsg = await aiEnhance(
      msg.startFailed(error instanceof Error ? error.message : String(error)),
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

/**
 * Core start logic, reused by AI tool.
 * `reply` is a callback to send progress updates — either interaction.editReply or sendToChannel.
 */
export async function performStart(
  reply: (msg: string) => Promise<unknown>,
): Promise<boolean> {
  const snapshots = await listSnapshots();
  if (snapshots.length === 0) {
    await reply(await aiEnhance(msg.noSnapshotsFound));
    return false;
  }

  const latestSnapshot = snapshots[0]!;
  log.info(`Using snapshot`, {
    id: latestSnapshot.id,
    created: latestSnapshot.created,
  });

  await reply(await aiEnhance(msg.creatingServer));
  const server = await createServer(latestSnapshot.id);
  const ip = server.public_net.ipv4.ip;

  let hostname = config.cloudflare.domain;
  try {
    await updateDnsRecord(ip);
  } catch (error) {
    log.error("DNS update failed, using raw IP", { error: String(error) });
    hostname = ip;
    await sendToChannel(await aiEnhance(msg.dnsUpdateFailed(ip)));
  }

  monitor.start(ip, config.game.queryPort);

  await reply(await aiEnhance(msg.waitingForGame));
  log.info("Waiting for game server", { ip, port: config.game.queryPort, timeoutMs: config.game.serverReadyTimeoutMs });
  await waitForGameReady(ip, config.game.queryPort, config.game.serverReadyTimeoutMs);
  await reply(await aiEnhance(msg.serverReady(hostname)));
  return true;
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
