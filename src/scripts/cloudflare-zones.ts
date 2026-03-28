const token = Bun.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN in .env and run: bun run cf-zones");
  process.exit(1);
}

const res = await fetch("https://api.cloudflare.com/client/v4/zones", {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.error(`Cloudflare API error ${res.status}:`, await res.text());
  process.exit(1);
}

const { result } = await res.json() as { result: { id: string; name: string }[] };

if (result.length === 0) {
  console.log("No zones found.");
  process.exit(0);
}

for (const zone of result) {
  console.log(`${zone.name.padEnd(40)} id=${zone.id}`);
}
