declare module "gamedig" {
  export interface QueryOptions {
    type: string;
    host: string;
    port?: number;
  }

  export interface Player {
    name?: string;
    raw?: Record<string, unknown>;
  }

  export interface QueryResult {
    name: string;
    map: string;
    password: boolean;
    numplayers: number;
    maxplayers: number;
    players: Player[];
    ping: number;
  }

  export class GameDig {
    static query(options: QueryOptions): Promise<QueryResult>;
  }
}
