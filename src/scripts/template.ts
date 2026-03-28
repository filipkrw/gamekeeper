const templates: Record<string, string> = {
  enshrouded: `# Discord
DISCORD_TOKEN=
DISCORD_GUILD_ID=
DISCORD_CHANNEL_ID=

# Hetzner Cloud
HETZNER_API_TOKEN=
HETZNER_SERVER_NAME=enshrouded
HETZNER_SERVER_TYPE=ccx23
HETZNER_LOCATION=fsn1
HETZNER_SSH_KEY_NAMES=

# Cloudflare DNS
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_RECORD_ID=
CLOUDFLARE_DOMAIN=

# Game server
GAME_TYPE=enshrouded
GAME_QUERY_PORT=15637
GAME_SERVER_READY_TIMEOUT_MS=600000

# Idle shutdown
IDLE_CHECK_INTERVAL_MS=30000
IDLE_TIMEOUT_MS=900000
SHUTDOWN_GRACE_PERIOD_MS=120000
MAX_SNAPSHOTS_TO_KEEP=3
`,
};

const args = Bun.argv.slice(2);
const game = args.find((a) => !a.startsWith("-"));
const force = args.includes("--force") || args.includes("-f");
const available = Object.keys(templates).join(", ");

if (!game) {
  console.error(`Usage: bun run template <game> [--force]\nAvailable games: ${available}`);
  process.exit(1);
}

if (!(game in templates)) {
  console.error(`Unknown game: ${game}\nAvailable games: ${available}`);
  process.exit(1);
}

const path = ".env";
if (!force && (await Bun.file(path).exists())) {
  console.error(`.env already exists. Use --force or -f to overwrite.`);
  process.exit(1);
}

await Bun.write(path, templates[game]!);
console.log(`Created .env for ${game}.`);
