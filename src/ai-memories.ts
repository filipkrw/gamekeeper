import { config } from "./config.ts";
import { log } from "./logger.ts";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

interface Memory {
  content: string;
  createdAt: string;
}

interface MemoryFile {
  memories: Memory[];
}

export async function loadMemories(): Promise<Memory[]> {
  try {
    const file = Bun.file(config.ai.memoriesPath);
    if (!(await file.exists())) return [];
    const data = JSON.parse(await file.text()) as MemoryFile;
    return data.memories ?? [];
  } catch {
    return [];
  }
}

export async function saveMemory(content: string): Promise<void> {
  const memories = await loadMemories();
  memories.push({ content, createdAt: new Date().toISOString() });

  const dir = dirname(config.ai.memoriesPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  await Bun.write(config.ai.memoriesPath, JSON.stringify({ memories }, null, 2));
  log.info("Memory saved", { total: memories.length });
}

export async function formatMemories(): Promise<string> {
  const memories = await loadMemories();
  if (memories.length === 0) return "";
  return (
    "\n\nYour memories:\n" +
    memories.map((m) => `- ${m.content}`).join("\n")
  );
}
