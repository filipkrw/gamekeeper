import { describe, test, expect } from "bun:test";
import { applyTemplate, templates } from "../scripts/template.ts";

const EXAMPLE = `# Discord
DISCORD_TOKEN=
DISCORD_GUILD_ID=

# Hetzner Cloud
HETZNER_SERVER_NAME=game-server
HETZNER_SERVER_TYPE=ccx23

# Game server
GAME_TYPE=
GAME_QUERY_PORT=
`;

describe("applyTemplate", () => {
  test("replaces overridden keys", () => {
    const result = applyTemplate(EXAMPLE, { GAME_TYPE: "enshrouded", GAME_QUERY_PORT: "15637" });
    expect(result).toContain("GAME_TYPE=enshrouded");
    expect(result).toContain("GAME_QUERY_PORT=15637");
  });

  test("leaves non-overridden keys unchanged", () => {
    const result = applyTemplate(EXAMPLE, { GAME_TYPE: "enshrouded" });
    expect(result).toContain("HETZNER_SERVER_NAME=game-server");
    expect(result).toContain("HETZNER_SERVER_TYPE=ccx23");
    expect(result).toContain("DISCORD_TOKEN=");
  });

  test("preserves comments and blank lines", () => {
    const result = applyTemplate(EXAMPLE, {});
    expect(result).toContain("# Discord");
    expect(result).toContain("# Hetzner Cloud");
    expect(result).toBe(EXAMPLE);
  });

  test("overwrites existing values, not just empty ones", () => {
    const result = applyTemplate(EXAMPLE, { HETZNER_SERVER_NAME: "myserver" });
    expect(result).toContain("HETZNER_SERVER_NAME=myserver");
    expect(result).not.toContain("HETZNER_SERVER_NAME=game-server");
  });
});

describe("enshrouded template", () => {
  test("sets expected keys", () => {
    const overrides = templates.enshrouded!;
    expect(overrides.GAME_TYPE).toBe("enshrouded");
    expect(overrides.GAME_QUERY_PORT).toBe("15637");
    expect(overrides.HETZNER_SERVER_NAME).toBe("enshrouded");
  });

  test("does not override location", () => {
    expect(templates.enshrouded).not.toHaveProperty("HETZNER_LOCATION");
  });

  test("produces valid output against real .env.example", async () => {
    const example = await Bun.file(".env.example").text();
    const result = applyTemplate(example, templates.enshrouded!);
    expect(result).toContain("GAME_TYPE=enshrouded");
    expect(result).toContain("GAME_QUERY_PORT=15637");
    expect(result).toContain("HETZNER_SERVER_NAME=enshrouded");
    // Credentials left blank
    expect(result).toContain("DISCORD_TOKEN=");
    expect(result).toContain("HETZNER_API_TOKEN=");
  });
});
