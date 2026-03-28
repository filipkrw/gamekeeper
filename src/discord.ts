import { Client, GatewayIntentBits, type TextChannel } from "discord.js";
import { config } from "./config.ts";

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let notifyChannel: TextChannel | null = null;

export async function sendToChannel(content: string): Promise<void> {
  if (!notifyChannel) {
    const channel = await client.channels.fetch(config.discord.channelId);
    notifyChannel = channel as TextChannel;
  }
  await notifyChannel.send(content);
}
