import { config } from "../config.ts";
import { log } from "../logger.ts";

const BASE_URL = "https://api.hetzner.cloud/v1";

// --- Types (only fields we use) ---

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4: { ip: string };
  };
  server_type: { name: string };
  created: string;
}

export interface HetznerImage {
  id: number;
  description: string;
  created: string;
  image_size: number;
}

interface HetznerAction {
  id: number;
  status: string;
  error?: { code: string; message: string };
}

// --- Internal fetch helper ---

async function hetznerFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.hetzner.apiToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Hetzner API ${res.status}: ${JSON.stringify(body)}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Server operations ---

export async function findServer(): Promise<HetznerServer | null> {
  const data = await hetznerFetch<{ servers: HetznerServer[] }>(
    `/servers?name=${config.hetzner.serverName}`
  );
  return data.servers[0] ?? null;
}

export async function createServer(imageId: number): Promise<HetznerServer> {
  const sshKeyId = await findSSHKey(config.hetzner.sshKeyName);

  const data = await hetznerFetch<{ server: HetznerServer }>("/servers", {
    method: "POST",
    body: JSON.stringify({
      name: config.hetzner.serverName,
      server_type: config.hetzner.serverType,
      location: config.hetzner.location,
      image: imageId,
      ssh_keys: [sshKeyId],
      start_after_create: true,
    }),
  });

  log.info(`Server created`, { id: data.server.id, name: data.server.name });
  return data.server;
}

export async function deleteServer(id: number): Promise<void> {
  await hetznerFetch(`/servers/${id}`, { method: "DELETE" });
  log.info(`Server deleted`, { id });
}

// --- Snapshots ---

export async function createSnapshot(
  serverId: number
): Promise<{ imageId: number; actionId: number }> {
  const data = await hetznerFetch<{ image: { id: number }; action: HetznerAction }>(
    `/servers/${serverId}/actions/create_image`,
    {
      method: "POST",
      body: JSON.stringify({ type: "snapshot", description: `enshrouded-${Date.now()}` }),
    }
  );
  log.info(`Snapshot started`, { imageId: data.image.id, actionId: data.action.id });
  return { imageId: data.image.id, actionId: data.action.id };
}

export async function listSnapshots(): Promise<HetznerImage[]> {
  const data = await hetznerFetch<{ images: HetznerImage[] }>(
    `/images?type=snapshot&sort=created:desc&label_selector=&per_page=50`
  );
  return data.images;
}

export async function deleteImage(id: number): Promise<void> {
  await hetznerFetch(`/images/${id}`, { method: "DELETE" });
  log.info(`Image deleted`, { id });
}

// --- Actions ---

export async function waitForAction(
  serverId: number,
  actionId: number,
  timeoutMs = 600_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const data = await hetznerFetch<{ action: HetznerAction }>(
        `/servers/${serverId}/actions/${actionId}`
      );
      if (data.action.status === "success") return;
      if (data.action.status === "error") {
        throw new Error(`Action ${actionId} failed: ${JSON.stringify(data.action.error)}`);
      }
    } catch (error) {
      if (String(error).includes("404")) {
        // Action not yet available — retry
      } else {
        throw error;
      }
    }

    await Bun.sleep(5_000);
  }
  throw new Error(`Action ${actionId} timed out after ${timeoutMs}ms`);
}

export async function waitForServerRunning(serverId: number, timeoutMs = config.game.serverReadyTimeoutMs): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await hetznerFetch<{ server: HetznerServer }>(`/servers/${serverId}`);
    if (data.server.status === "running") return;
    await Bun.sleep(5_000);
  }
  throw new Error(`Server ${serverId} did not become running within ${timeoutMs}ms`);
}

// --- Lookups ---

async function findSSHKey(name: string): Promise<number> {
  const data = await hetznerFetch<{ ssh_keys: { id: number; name: string }[] }>(
    `/ssh_keys?name=${name}`
  );
  const key = data.ssh_keys[0];
  if (!key) throw new Error(`SSH key not found: ${name}`);
  return key.id;
}

