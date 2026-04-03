import { queryServer } from "./services/gamedig.ts";
import { findServer } from "./services/hetzner.ts";
import { sendToChannel } from "./discord.ts";
import { commandLock } from "./lock.ts";
import { performStop } from "./commands/stop.ts";
import { config } from "./config.ts";
import { msg } from "./messages.ts";
import { log } from "./logger.ts";
import { aiEnhance } from "./ai.ts";

class ServerMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private idleStartedAt: number | null = null;
  private failCount = 0;
  private previousPlayers = new Set<string>();
  private previousCount = 0;
  private isShuttingDown = false;
  private host = "";
  private port = 0;

  start(host: string, port: number): void {
    if (this.timer) return;
    this.reset();
    this.host = host;
    this.port = port;
    this.timer = setInterval(() => this.poll(), config.idle.checkIntervalMs);
    log.info("Monitor started", { host, port });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info("Monitor stopped");
    }
    this.reset();
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private reset(): void {
    this.idleStartedAt = null;
    this.failCount = 0;
    this.previousPlayers = new Set();
    this.previousCount = 0;
    this.isShuttingDown = false;
  }

  private async poll(): Promise<void> {
    try {
      const status = await queryServer(this.host, this.port);

      if (!status) {
        this.failCount++;
        if (this.failCount >= 100) {
          log.warn("100 consecutive query failures, triggering shutdown");
          await sendToChannel(await aiEnhance(msg.serverUnreachable));
          await this.triggerAutoStop();
        }
        return;
      }

      this.failCount = 0;

      // Player activity notifications
      await this.notifyPlayerChanges(status.players, status.playerCount, status.maxPlayers);

      // Idle tracking
      if (status.playerCount === 0) {
        if (this.idleStartedAt === null) {
          this.idleStartedAt = Date.now();
        } else if (!this.isShuttingDown && Date.now() - this.idleStartedAt >= config.idle.timeoutMs) {
          this.isShuttingDown = true;
          const minutes = Math.round(config.idle.timeoutMs / 60_000);
          log.info("Idle timeout reached, shutdown scheduled", { gracePeriodMs: config.idle.gracePeriodMs });
          await sendToChannel(await aiEnhance(msg.idleShutdownWarning(minutes)));

          setTimeout(async () => {
            if (!this.isShuttingDown) return;

            // Final check
            const finalStatus = await queryServer(this.host, this.port);
            if (finalStatus && finalStatus.playerCount > 0) {
              this.isShuttingDown = false;
              this.idleStartedAt = null;
              await sendToChannel(await aiEnhance(msg.shutdownCancelled));
              return;
            }

            await this.triggerAutoStop();
          }, config.idle.gracePeriodMs);
        }
      } else {
        if (this.isShuttingDown) {
          this.isShuttingDown = false;
          // Don't post cancellation here — the setTimeout callback will handle it
        }
        this.idleStartedAt = null;
      }
    } catch (error) {
      log.error("Monitor poll error", { error: String(error) });
    }
  }

  private async notifyPlayerChanges(
    currentPlayers: string[],
    currentCount: number,
    maxPlayers: number
  ): Promise<void> {
    const currentSet = new Set(currentPlayers);
    const hasNames = currentPlayers.length > 0 || this.previousPlayers.size > 0;

    const messages: string[] = [];

    if (hasNames) {
      // Name-based tracking
      for (const name of currentPlayers) {
        if (!this.previousPlayers.has(name)) {
          log.info("Player joined", { name, count: currentCount, max: maxPlayers });
          messages.push(msg.playerJoined(name));
        }
      }
      for (const name of this.previousPlayers) {
        if (!currentSet.has(name)) {
          log.info("Player left", { name, count: currentCount, max: maxPlayers });
          messages.push(msg.playerLeft(name));
        }
      }
      this.previousPlayers = currentSet;
    } else {
      // Count-based fallback
      const diff = currentCount - this.previousCount;
      if (diff > 0) {
        log.info("Players joined", { diff, count: currentCount, max: maxPlayers });
        messages.push(msg.playersJoined(diff, currentCount, maxPlayers));
      } else if (diff < 0) {
        log.info("Players left", { diff: Math.abs(diff), count: currentCount, max: maxPlayers });
        messages.push(msg.playersLeft(Math.abs(diff), currentCount, maxPlayers));
      }
    }

    this.previousCount = currentCount;

    if (messages.length > 0) {
      await sendToChannel(await aiEnhance(messages.join("\n")));
    }
  }

  private async triggerAutoStop(): Promise<void> {
    this.stop();

    if (!commandLock.acquire("auto-stop")) {
      log.warn("Cannot auto-stop: another operation in progress");
      return;
    }

    try {
      const server = await findServer();
      if (!server) return;
      const statusMsg = await sendToChannel(await aiEnhance(msg.autoStopped));
      const deleted = await performStop(server.id, server.public_net.ipv4.ip, (content) => statusMsg.edit(content));
      if (!deleted) {
        this.start(this.host, this.port);
      }
    } catch (error) {
      log.error("Auto-stop failed", { error: String(error) });
      await sendToChannel(await aiEnhance(msg.autoStopFailed(error instanceof Error ? error.message : String(error))));
    } finally {
      commandLock.release();
    }
  }
}

export const monitor = new ServerMonitor();
