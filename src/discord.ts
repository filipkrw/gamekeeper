import { Client, GatewayIntentBits, type Message, type TextChannel } from "discord.js";
import { config } from "./config.ts";

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let notifyChannel: TextChannel | null = null;

export async function sendToChannel(content: string): Promise<Message> {
  if (!notifyChannel) {
    const channel = await client.channels.fetch(config.discord.channelId);
    notifyChannel = channel as TextChannel;
  }
  return notifyChannel.send(content);
}
