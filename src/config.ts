function required(name: string): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return Bun.env[name] || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const value = Bun.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for ${name}: ${value}`);
  return parsed;
}

export const config = Object.freeze({
  discord: {
    token: required("DISCORD_TOKEN"),
    guildId: required("DISCORD_GUILD_ID"),
    channelId: required("DISCORD_CHANNEL_ID"),
  },
  hetzner: {
    apiToken: required("HETZNER_API_TOKEN"),
    serverName: optional("HETZNER_SERVER_NAME", "enshrouded"),
    serverType: optional("HETZNER_SERVER_TYPE", "ccx23"),
    location: optional("HETZNER_LOCATION", "fsn1"),
    sshKeyNames: required("HETZNER_SSH_KEY_NAMES").split(",").map((s) => s.trim()),
  },
  cloudflare: {
    apiToken: required("CLOUDFLARE_API_TOKEN"),
    zoneId: required("CLOUDFLARE_ZONE_ID"),
    recordId: required("CLOUDFLARE_RECORD_ID"),
    domain: required("CLOUDFLARE_DOMAIN"),
  },
  game: {
    queryPort: optionalInt("GAME_QUERY_PORT", 15637),
    serverReadyTimeoutMs: optionalInt("GAME_SERVER_READY_TIMEOUT_MS", 600_000),
  },
  idle: {
    checkIntervalMs: optionalInt("IDLE_CHECK_INTERVAL_MS", 30_000),
    timeoutMs: optionalInt("IDLE_TIMEOUT_MS", 900_000),
    gracePeriodMs: optionalInt("SHUTDOWN_GRACE_PERIOD_MS", 120_000),
  },
  snapshots: {
    maxToKeep: optionalInt("MAX_SNAPSHOTS_TO_KEEP", 3),
  },
});
