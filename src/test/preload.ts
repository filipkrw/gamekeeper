// Set env vars before any module evaluation — prevents config.ts from throwing
Bun.env.DISCORD_TOKEN = "test-token";
Bun.env.DISCORD_GUILD_ID = "test-guild";
Bun.env.DISCORD_CHANNEL_ID = "test-channel";
Bun.env.HETZNER_API_TOKEN = "test-hetzner-token";
Bun.env.HETZNER_SSH_KEY_NAME = "test-key";
Bun.env.CLOUDFLARE_API_TOKEN = "test-cf-token";
Bun.env.CLOUDFLARE_ZONE_ID = "test-zone";
Bun.env.CLOUDFLARE_RECORD_ID = "test-record";
Bun.env.CLOUDFLARE_SUBDOMAIN = "enshrouded.example.com";
Bun.env.IDLE_CHECK_INTERVAL_MS = "100";
Bun.env.IDLE_THRESHOLD_CHECKS = "3";
Bun.env.SHUTDOWN_GRACE_PERIOD_MS = "100";

// Mock Bun.sleep to resolve immediately in tests
Bun.sleep = (() => Promise.resolve()) as typeof Bun.sleep;
