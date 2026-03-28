# Sleeper Agent

A Discord bot that manages an on-demand game server on Hetzner Cloud. Players use `/start`, `/stop`, and `/status` slash commands to control the server. The server is created from a snapshot when needed and automatically shut down after a configurable idle period.

## How it works

- `/start` — creates a server from the latest Hetzner snapshot, updates DNS, waits until the game is queryable
- `/stop` — snapshots the server, then deletes it
- `/status` — shows current server state, player count, uptime, and cost
- Auto-shutdown — after no players are detected for the idle timeout, the bot warns in Discord and shuts the server down automatically

## Setup

### 1. Install dependencies

Requires [Bun](https://bun.sh).

```bash
bun install
```

### 2. Configure environment

```bash
bun run template enshrouded
```

This creates a `.env` with game-specific values pre-filled. Fill in the credentials — see [Configuration](#configuration) below. Use `--force` to overwrite an existing `.env`.

### 3. Register slash commands (one-time)

```bash
bun run register
```

### 4. Deploy

```bash
docker compose up -d
```

Or run directly:

```bash
bun run start
```

## Configuration

### Discord

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token. Discord Developer Portal → your application → **Bot** → **Reset Token** |
| `DISCORD_GUILD_ID` | yes | Your server's ID. Enable Developer Mode first (User Settings → Advanced → Developer Mode), then right-click your server → **Copy Server ID** |
| `DISCORD_CHANNEL_ID` | yes | Channel where the bot posts updates. Right-click the channel → **Copy Channel ID** (Developer Mode required) |

To create a bot: go to the [Discord Developer Portal](https://discord.com/developers/applications), create a new application, go to **Bot**, and add it to your server via **OAuth2 → URL Generator** with the `bot` and `applications.commands` scopes and `Send Messages` permission.

### Hetzner Cloud

| Variable | Required | Default | Description |
|---|---|---|---|
| `HETZNER_API_TOKEN` | yes | — | Hetzner Cloud Console → your project → **Security** → **API Tokens** → **Generate API Token** (Read & Write) |
| `HETZNER_SSH_KEY_NAMES` | no | — | Comma-separated names of SSH keys to add to the server. Manage keys under **Security** → **SSH Keys** |
| `HETZNER_SERVER_NAME` | no | `game-server` | Name assigned to the created server |
| `HETZNER_SERVER_TYPE` | no | `ccx23` | Server type (CPU/RAM). See [Hetzner server types](https://www.hetzner.com/cloud) |
| `HETZNER_LOCATION` | no | `fsn1` | Datacenter location: `fsn1`, `nbg1`, `hel1`, `ash`, `hil`, `sin` |

The bot creates servers from snapshots. You need to have at least one snapshot in your Hetzner project before running `/start`.

### Cloudflare DNS

The bot updates a DNS A record to point to the server's IP when it starts.

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token** → use the **Edit zone DNS** template. Requires Zone:DNS:Edit permission. |
| `CLOUDFLARE_ZONE_ID` | yes | Once `CLOUDFLARE_API_TOKEN` is set in `.env`, run `bun run cf-zones` to list zones with their IDs. |
| `CLOUDFLARE_RECORD_ID` | yes | ID of the A record to update. Once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are set in `.env`, run `bun run cf-records` to list all A records with their IDs. |
| `CLOUDFLARE_DOMAIN` | yes | The full domain of the A record, e.g. `game.example.com` |

### Game server

| Variable | Required | Default | Description |
|---|---|---|---|
| `GAME_TYPE` | yes | — | GameDig game type identifier. Must be a valid type from the [supported games list](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md) |
| `GAME_QUERY_PORT` | yes | — | UDP port the bot queries to check server status and read the player list. Used to detect when the server is ready after `/start`, who is online, and whether to delay or cancel auto-shutdown. Getting this wrong means the bot treats the server as always empty or never ready. Check your game's documentation. |
| `GAME_SERVER_READY_TIMEOUT_MS` | no | `600000` | How long to wait for the game to become queryable after the server boots (ms) |

### Tuning

| Variable | Default | Description |
|---|---|---|
| `IDLE_CHECK_INTERVAL_MS` | `30000` | How often to poll for active players (ms) |
| `IDLE_TIMEOUT_MS` | `900000` | How long the server can be empty before shutdown is triggered (ms) |
| `SHUTDOWN_GRACE_PERIOD_MS` | `120000` | Warning period in Discord before the actual shutdown happens (ms) |
| `MAX_SNAPSHOTS_TO_KEEP` | `3` | Number of snapshots to retain — older ones are deleted after each `/stop` |

## Development

```bash
bun run dev   # start with file watching
bun test      # run test suite
```
