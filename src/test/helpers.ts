import { mock } from "bun:test";
import type { HetznerServer, HetznerImage } from "../services/hetzner.ts";
import type { ServerStatus } from "../services/gamedig.ts";

// --- Mock interaction ---

export function mockInteraction(commandName: string) {
  let deferred = false;

  const interaction = {
    commandName,
    get deferred() {
      return deferred;
    },
    reply: mock(async (_msg: unknown) => {}),
    deferReply: mock(async () => {
      deferred = true;
    }),
    editReply: mock(async (_msg: unknown) => {}),
  };

  return interaction;
}

export type MockInteraction = ReturnType<typeof mockInteraction>;

// --- Mock data factories ---

export function createMockServer(overrides?: Partial<HetznerServer>): HetznerServer {
  return {
    id: 12345,
    name: "game-server",
    status: "running",
    public_net: { ipv4: { ip: "1.2.3.4" } },
    server_type: { name: "ccx23" },
    created: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
    ...overrides,
  };
}

export function createMockSnapshot(overrides?: Partial<HetznerImage>): HetznerImage {
  return {
    id: 99,
    description: "snapshot-12345",
    created: new Date().toISOString(),
    image_size: 30,
    ...overrides,
  };
}

export function createMockGameStatus(overrides?: Partial<ServerStatus>): ServerStatus {
  return {
    online: true,
    players: ["Alice", "Bob"],
    playerCount: 2,
    maxPlayers: 16,
    ...overrides,
  };
}

// --- Module mock references ---
// The actual mock.module() calls happen in each test file (hoisted there).
// These are the mock function handles tests use to control behavior.

export const channelMessages: string[] = [];

export const hetznerMocks = {
  findServer: mock<() => Promise<HetznerServer | null>>(() => Promise.resolve(null)),
  createServer: mock<(imageId: number) => Promise<HetznerServer>>(() =>
    Promise.resolve(createMockServer())
  ),
  deleteServer: mock<(id: number) => Promise<void>>(() => Promise.resolve()),
  createSnapshot: mock<
    (serverId: number) => Promise<{ imageId: number; actionId: number }>
  >(() => Promise.resolve({ imageId: 100, actionId: 200 })),
  waitForAction: mock<(actionId: number) => Promise<void>>(() => Promise.resolve()),
  waitForServerRunning: mock<(serverId: number) => Promise<void>>(() => Promise.resolve()),
  listSnapshots: mock<() => Promise<HetznerImage[]>>(() =>
    Promise.resolve([createMockSnapshot()])
  ),
  deleteImage: mock<(id: number) => Promise<void>>(() => Promise.resolve()),
};

export const cloudflareMocks = {
  updateDnsRecord: mock<(ip: string) => Promise<void>>(() => Promise.resolve()),
};

export const gamedigMocks = {
  queryServer: mock<(host: string, port: number) => Promise<ServerStatus | null>>(() =>
    Promise.resolve(createMockGameStatus())
  ),
};

const mockMessage = {
  edit: mock(async (content: string) => {
    channelMessages.push(content);
    return mockMessage;
  }),
};

export const sendToChannelMock = mock(async (content: string) => {
  channelMessages.push(content);
  return mockMessage;
});

export function resetAllMocks() {
  channelMessages.length = 0;

  for (const fn of Object.values(hetznerMocks)) fn.mockClear();
  for (const fn of Object.values(cloudflareMocks)) fn.mockClear();
  for (const fn of Object.values(gamedigMocks)) fn.mockClear();
  sendToChannelMock.mockClear();
  mockMessage.edit.mockClear();

  // Reset to defaults
  hetznerMocks.findServer.mockImplementation(() => Promise.resolve(null));
  hetznerMocks.createServer.mockImplementation(() => Promise.resolve(createMockServer()));
  hetznerMocks.deleteServer.mockImplementation(() => Promise.resolve());
  hetznerMocks.createSnapshot.mockImplementation(() =>
    Promise.resolve({ imageId: 100, actionId: 200 })
  );
  hetznerMocks.waitForAction.mockImplementation(() => Promise.resolve());
  hetznerMocks.waitForServerRunning.mockImplementation(() => Promise.resolve());
  hetznerMocks.listSnapshots.mockImplementation(() =>
    Promise.resolve([createMockSnapshot()])
  );
  hetznerMocks.deleteImage.mockImplementation(() => Promise.resolve());
  cloudflareMocks.updateDnsRecord.mockImplementation(() => Promise.resolve());
  gamedigMocks.queryServer.mockImplementation(() =>
    Promise.resolve(createMockGameStatus({ players: [], playerCount: 0 }))
  );
}
