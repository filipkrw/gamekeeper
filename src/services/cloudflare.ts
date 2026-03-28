import { config } from "../config.ts";
import { log } from "../logger.ts";

export async function updateDnsRecord(ip: string): Promise<void> {
  const { apiToken, zoneId, recordId, subdomain } = config.cloudflare;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "A",
        name: subdomain,
        content: ip,
        ttl: 60,
        proxied: false,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Cloudflare API ${res.status}: ${JSON.stringify(body)}`);
  }

  log.info(`DNS updated`, { subdomain, ip });
}
