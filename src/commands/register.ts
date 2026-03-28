import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../config.ts";
import { log } from "../logger.ts";

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Create and start the game server"),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop and snapshot the game server"),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show server status, players, and cost"),
];

const rest = new REST({ version: "10" }).setToken(config.discord.token);

try {
  log.info("Registering slash commands...");
  await rest.put(
    Routes.applicationGuildCommands(
      (await rest.get(Routes.currentApplication()) as { id: string }).id,
      config.discord.guildId
    ),
    { body: commands.map((c) => c.toJSON()) }
  );
  log.info("Slash commands registered.");
} catch (error) {
  log.error("Failed to register commands", { error: String(error) });
  process.exit(1);
}
