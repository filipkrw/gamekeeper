import { client, sendToChannel } from "./discord.ts";
import { config } from "./config.ts";
import { findServer } from "./services/hetzner.ts";
import { handleStart } from "./commands/start.ts";
import { handleStop } from "./commands/stop.ts";
import { handleStatus } from "./commands/status.ts";
import { monitor } from "./monitor.ts";
import { log } from "./logger.ts";

client.once("clientReady", async () => {
  log.info(`Logged in as ${client.user?.tag}`);

  // Resume monitoring if server is already running (handles bot restarts)
  try {
    const server = await findServer();
    if (server) {
      log.info("Existing server found, resuming monitor", {
        id: server.id,
        ip: server.public_net.ipv4.ip,
      });
      monitor.start(server.public_net.ipv4.ip, config.game.queryPort);
    }
  } catch (error) {
    log.error("Failed to check for existing server on startup", {
      error: String(error),
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  log.info("command received", {
    command: interaction.commandName,
    user: interaction.user.tag,
  });

  try {
    switch (interaction.commandName) {
      case "start":
        return await handleStart(interaction);
      case "stop":
        return await handleStop(interaction);
      case "status":
        return await handleStatus(interaction);
    }
  } catch (error) {
    log.error("Unhandled command error", {
      command: interaction.commandName,
      error: String(error),
    });
  }
});

client.login(config.discord.token);
