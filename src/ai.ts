import type { Message } from "discord.js";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { chatCompletion } from "./services/llm.ts";
import { config } from "./config.ts";
import { log } from "./logger.ts";
import { sendToChannel } from "./discord.ts";
import { formatMemories, saveMemory } from "./ai-memories.ts";
import { findServer } from "./services/hetzner.ts";
import { queryServer } from "./services/gamedig.ts";
import { commandLock } from "./lock.ts";
import { performStart } from "./commands/start.ts";
import { performStop } from "./commands/stop.ts";

interface HistoryEntry {
  author: string;
  content: string;
  isBot: boolean;
}

const history: HistoryEntry[] = [];

function addToHistory(entry: HistoryEntry): void {
  history.push(entry);
  while (history.length > config.ai.maxHistory) {
    history.shift();
  }
}

function buildSystemPrompt(memories: string): string {
  return `You are Gamekeeper, a Discord bot that manages a ${config.game.type} game server for a group of friends. You're fun, casual, and helpful. Keep responses short (1-2 sentences usually). You can start and stop the game server, check its status, and remember things about the people you talk to.

The server domain is ${config.cloudflare.domain}. When the server starts, players connect to that address.

You have tools to manage the server — use them when people ask. For save_memory, proactively remember interesting things about users (preferences, play times, etc.) without being asked.${memories}`;
}

function historyToMessages(): ChatCompletionMessageParam[] {
  return history.map((entry): ChatCompletionMessageParam =>
    entry.isBot
      ? { role: "assistant", content: entry.content }
      : { role: "user", content: `${entry.author}: ${entry.content}` },
  );
}

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "start_server",
      description: "Start the game server. Use when someone wants to play or asks to start the server.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "stop_server",
      description: "Stop the game server. Use when someone asks to shut down or stop the server.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "server_status",
      description: "Check the current server status, including whether it's online, player count, and who's playing.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a memory about a user or topic for future reference. Use to remember preferences, schedules, fun facts about users, etc.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The memory to save, e.g. 'Alex prefers playing in the evening'",
          },
        },
        required: ["content"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "start_server": {
      const server = await findServer();
      if (server) return "Server is already running.";
      if (!commandLock.acquire("start"))
        return `Can't start: /${commandLock.getOwner()} is in progress.`;

      // Fire and forget — release lock when done
      performStart((m) => sendToChannel(m))
        .catch((err) => log.error("AI-triggered start failed", { error: String(err) }))
        .finally(() => commandLock.release());

      return "Server start initiated. Progress updates will appear in the channel.";
    }

    case "stop_server": {
      const server = await findServer();
      if (!server) return "No server is currently running.";
      if (!commandLock.acquire("stop"))
        return `Can't stop: /${commandLock.getOwner()} is in progress.`;

      const ip = server.public_net.ipv4.ip;
      const status = await queryServer(ip, config.game.queryPort).catch(() => null);
      if (status && status.playerCount > 0) {
        commandLock.release();
        return `Can't stop: ${status.playerCount} player(s) still online (${status.players.join(", ")}).`;
      }

      // Fire and forget — release lock when done
      performStop(server.id, ip, (m) => sendToChannel(m))
        .catch((err) => log.error("AI-triggered stop failed", { error: String(err) }))
        .finally(() => commandLock.release());

      return "Server stop initiated. Progress updates will appear in the channel.";
    }

    case "server_status": {
      const server = await findServer();
      if (!server) return "Server is offline.";

      const ip = server.public_net.ipv4.ip;
      const status = await queryServer(ip, config.game.queryPort).catch(() => null);

      if (!status) return "Server is running but not responding to queries yet (probably still starting up).";

      const created = new Date(server.created);
      const uptimeMs = Date.now() - created.getTime();
      const hours = Math.floor(uptimeMs / 3_600_000);
      const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);

      const playerList =
        status.players.length > 0 ? ` Players: ${status.players.join(", ")}.` : "";
      return `Server is online. ${status.playerCount}/${status.maxPlayers} players. Uptime: ${hours}h ${minutes}m.${playerList}`;
    }

    case "save_memory": {
      const content = args.content as string;
      if (!content) return "No content provided.";
      await saveMemory(content);
      return "Memory saved.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function handleMessage(message: Message): Promise<void> {
  addToHistory({
    author: message.author.displayName,
    content: message.content,
    isBot: false,
  });

  const memories = await formatMemories();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(memories) },
    ...historyToMessages(),
  ];

  const response = await chatCompletion(messages, tools, executeTool);
  if (!response) return;

  addToHistory({ author: "Gamekeeper", content: response, isBot: true });
  await message.reply(response);
}

export async function aiEnhance(staticMessage: string): Promise<string> {
  if (!config.ai.enabled) return staticMessage;

  try {
    const memories = await formatMemories();
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(memories) },
      ...historyToMessages(),
      {
        role: "user",
        content: `Rephrase this bot status message with your personality. Keep it concise and convey the same information. Only respond with the rephrased message, nothing else.\n\nOriginal: ${staticMessage}`,
      },
    ];

    const response = await chatCompletion(messages);
    return response ?? staticMessage;
  } catch (error) {
    log.error("AI enhance failed, using static message", { error: String(error) });
    return staticMessage;
  }
}
