const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

if (!token || !zoneId) {
  console.error("Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... bun run cf-records");
  process.exit(1);
}

const res = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!res.ok) {
  console.error(`Cloudflare API error ${res.status}:`, await res.text());
  process.exit(1);
}

const { result } = await res.json() as { result: { id: string; name: string; content: string }[] };

if (result.length === 0) {
  console.log("No A records found in this zone.");
  process.exit(0);
}

for (const record of result) {
  console.log(`${record.name.padEnd(40)} ${record.content.padEnd(20)} id=${record.id}`);
}
