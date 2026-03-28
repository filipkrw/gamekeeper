import { type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { findServer } from "../services/hetzner.ts";
import { queryServer } from "../services/gamedig.ts";
import { config } from "../config.ts";
import { log } from "../logger.ts";

export async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const server = await findServer();

    if (!server) {
      await interaction.editReply("Server is offline.");
      return;
    }

    const status = await queryServer(
      server.public_net.ipv4.ip,
      config.game.queryPort
    );

    const created = new Date(server.created);
    const uptimeMs = Date.now() - created.getTime();
    const hours = Math.floor(uptimeMs / 3_600_000);
    const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);
    const uptimeStr = `${hours}h ${minutes}m`;

    const embed = new EmbedBuilder()
      .setTitle("Enshrouded Server Status")
      .setColor(status?.online ? 0x57f287 : 0xfee75c)
      .addFields(
        { name: "Status", value: status?.online ? "Online" : "Starting...", inline: true },
        { name: "Type", value: server.server_type.name.toUpperCase(), inline: true },
        { name: "Uptime", value: uptimeStr, inline: true },
        {
          name: "Players",
          value: status
            ? `${status.playerCount}/${status.maxPlayers}`
            : "Unknown",
          inline: true,
        }
      );

    if (status && status.players.length > 0) {
      embed.addFields({
        name: "Online Players",
        value: status.players.join(", "),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    log.error("Status command failed", { error: String(error) });
    await interaction.editReply("Failed to fetch server status.");
  }
}
