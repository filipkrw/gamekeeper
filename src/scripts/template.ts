const templates: Record<string, Record<string, string>> = {
  enshrouded: {
    HETZNER_SERVER_NAME: "enshrouded",
    GAME_TYPE: "enshrouded",
    GAME_QUERY_PORT: "15637",
  },
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

const envPath = ".env";
if (!force && (await Bun.file(envPath).exists())) {
  console.error(`.env already exists. Use --force or -f to overwrite.`);
  process.exit(1);
}

const example = await Bun.file(".env.example").text();
const overrides = templates[game]!;

const result = example.replace(/^(\w+)=(.*)$/gm, (match, key, _value) => {
  return key in overrides ? `${key}=${overrides[key]}` : match;
});

await Bun.write(envPath, result);
console.log(`Created .env for ${game}.`);
