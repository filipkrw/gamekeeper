# Enshrouded Server Bot

Discord bot that manages an on-demand Enshrouded game server on Hetzner Cloud. Players use `/start`, `/stop`, and `/status` slash commands. The server is created from a snapshot when needed and automatically shut down (snapshotted + deleted) after 15 minutes of inactivity.

## Tech Stack

- **Runtime:** Bun (not Node.js)
- **Language:** TypeScript (strict mode)
- **Dependencies:** discord.js, gamedig — that's it
- **External APIs:** Hetzner Cloud REST API and Cloudflare DNS via plain `fetch` (no client libraries)

## Commands

```bash
bun run dev          # start with --watch
bun run start        # production start
bun run register     # register slash commands with Discord (one-time)
bun test             # run all tests
docker compose up -d # deploy via Docker
```

## Project Structure

```
src/
  index.ts           # Entry point — login, route commands, resume monitor on restart
  config.ts          # Typed config from Bun.env, fails fast on missing vars
  discord.ts         # Discord client + sendToChannel() helper
  lock.ts            # In-memory mutex preventing concurrent /start and /stop
  logger.ts          # Timestamped console logging
  monitor.ts         # Background polling loop — idle auto-shutdown + player join/leave notifications
  services/
    hetzner.ts       # Hetzner Cloud REST wrapper (~10 endpoints)
    cloudflare.ts    # DNS A record update (single PUT)
    gamedig.ts       # Game server query wrapper
  commands/
    register.ts      # Slash command definitions (run standalone to register)
    start.ts         # /start — create from snapshot, DNS, monitor, readiness check
    stop.ts          # /stop — snapshot (retry once), delete, cleanup old snapshots
    status.ts        # /status — embed with state, players, uptime, cost
  test/
    preload.ts       # Sets test env vars + mocks Bun.sleep (loaded via bunfig.toml)
    helpers.ts       # Mock factories for interactions, servers, snapshots, game status
    *.test.ts        # Integration tests per command + monitor + lock
```

## Key Design Decisions

- **No database** — all state is ephemeral and reconstructable from the Hetzner API on bot restart
- **Plain fetch for Hetzner/Cloudflare** — API surface is small (~10 endpoints total), no need for client libraries
- **Boolean lock** (not async mutex) — JS is single-threaded; the lock gates overlapping async flows at `await` points
- **`performStop()` is exported** from stop.ts — reused by both the `/stop` command and auto-shutdown in monitor.ts
- **Monitor resumes on restart** — if the bot crashes and restarts, it checks for an existing Hetzner server and resumes monitoring

## Testing

Tests mock at the module boundary using `mock.module()` in each test file (hoisted by bun). A preload script (`src/test/preload.ts`) sets env vars so config.ts doesn't throw during tests. Bun.sleep is mocked to resolve immediately.

Monitor tests call the private `poll()` method directly rather than using fake timers. Grace period `setTimeout` is intercepted by replacing `globalThis.setTimeout`.

## Environment

All config is via environment variables (Bun loads `.env` automatically). See `.env.example` for the full list. Required vars: `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, `HETZNER_API_TOKEN`, `HETZNER_SSH_KEY_NAMES`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_RECORD_ID`, `CLOUDFLARE_SUBDOMAIN`.
