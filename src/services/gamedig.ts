import { GameDig, Type } from "gamedig";
import { config } from "../config.ts";

export interface ServerStatus {
  online: boolean;
  players: string[];
  playerCount: number;
  maxPlayers: number;
}

export async function queryServer(host: string, port: number): Promise<ServerStatus | null> {
  try {
    const result = await GameDig.query({
      type: config.game.type as Type,
      host,
      port,
    });

    return {
      online: true,
      players: result.players
        .map((p) => p.name)
        .filter((n): n is string => Boolean(n)),
      playerCount: result.numplayers ?? result.players.length,
      maxPlayers: result.maxplayers ?? 16,
    };
  } catch {
    return null;
  }
}
