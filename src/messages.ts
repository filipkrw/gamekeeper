// All user-facing Discord messages in one place for easy editing.

export const msg = {
  // --- Shared ---
  operationInProgress: (owner: string) => `A \`/${owner}\` operation is already in progress.`,

  // --- /start ---
  serverAlreadyRunning: "Server is already running.",
  noSnapshotsFound: "No snapshots found. Cannot start server.",
  creatingServer: "Creating server from snapshot...",
  dnsUpdateFailed: (ip: string) => `DNS update failed. Connect using IP: \`${ip}\``,
  waitingForGame: "Server created. Waiting for game server to start...",
  serverReady: (hostname: string) => `Server is ready! Connect to \`${hostname}\``,
  serverStarting: (hostname: string) => `Server is running but game may still be starting. Connect to \`${hostname}\``,
  startFailed: (error: string) => `Failed to start server: ${error}`,

  // --- /stop ---
  noServerRunning: "No server is running.",
  playersOnline: (count: number) => `Cannot stop: ${count} player(s) are currently online.`,
  creatingSnapshot: "Creating snapshot...",
  snapshotFailed: "Snapshot failed after 2 attempts. Server NOT deleted to prevent data loss.",
  playerJoinedDuringSnapshot: "Player(s) joined during snapshot. Server kept alive.",
  deletingServer: "Snapshot saved. Deleting server...",
  serverStopped: "Server stopped and saved.",
  stopFailed: (error: string) => `Failed to stop server: ${error}`,

  // --- /status ---
  serverOffline: "Server is offline.",
  statusTitle: "Enshrouded Server Status",
  statusOnline: "Online",
  statusStarting: "Starting...",
  statusFailed: "Failed to fetch server status.",

  // --- Monitor ---
  serverUnreachable: "Game server has been unreachable for ~50 minutes. Shutting down...",
  idleShutdownWarning: (minutes: number) => `No players detected for ${minutes} minutes. Shutting down in 2 minutes...`,
  shutdownCancelled: "Player joined — shutdown cancelled.",
  autoStopped: "Server auto-stopped due to inactivity.",
  playerJoined: (name: string) => `🟢 **${name}** joined the server`,
  playerLeft: (name: string) => `🔴 **${name}** left the server`,
  playersJoined: (count: number, current: number, max: number) =>
    `🟢 ${count === 1 ? "A player" : `${count} players`} joined (${current}/${max})`,
  playersLeft: (count: number, current: number, max: number) =>
    `🔴 ${count === 1 ? "A player" : `${count} players`} left (${current}/${max})`,
  autoStopFailed: (error: string) => `Auto-stop failed: ${error}`,
};
