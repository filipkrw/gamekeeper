// All user-facing Discord messages in one place for easy editing.

const SUPPORTED_LOCALES = ["en", "pl"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const rawLocale = Bun.env.BOT_LOCALE ?? "en";
const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(rawLocale)
  ? (rawLocale as Locale)
  : (() => {
      console.warn(`Unknown locale "${rawLocale}", falling back to "en"`);
      return "en" as Locale;
    })();

const locales = {
  en: {
    // --- Shared ---
    operationInProgress: (owner: string | null) =>
      owner
        ? `Operation \`/${owner}\` is already in progress.`
        : "Another operation is already in progress.",

    // --- /start ---
    serverAlreadyRunning: "Server is already running.",
    noSnapshotsFound: "No server snapshots found. Cannot start the server.",
    creatingServer: "Creating server...",
    dnsUpdateFailed: (ip: string) =>
      `DNS update failed. Connect using IP: \`${ip}\``,
    waitingForGame:
      "Server created. Loading last save (this may take a few minutes)...",
    serverReady: (hostname: string) =>
      `Server ready! Connect to \`${hostname}\``,
    startFailed: (error: string) => `Failed to start server: ${error}`,

    // --- /stop ---
    noServerRunning: "No server is currently running.",
    playersOnline: (count: number) =>
      `Cannot stop: ${count} ${count === 1 ? "player" : "players"} online.`,
    creatingSnapshot: "Saving server state...",
    snapshotFailed: "Snapshot failed, leaving server running.",
    playerJoinedDuringSnapshot:
      "Someone joined while saving. Server remains online.",
    deletingServer: "Server saved. Shutting down...",
    serverStopped: "Server stopped and saved.",
    stopFailed: (error: string) => `Failed to stop server: ${error}`,

    // --- /status ---
    serverOffline: "Server is offline.",
    statusTitle: "Status",
    statusOnline: "Online",
    statusStarting: "Starting...",
    statusFailed: "Failed to fetch server status.",
    statusFieldStatus: "Status",
    statusFieldUptime: "Uptime",
    statusFieldPlayers: "Players",
    statusFieldOnlinePlayers: "Players online",

    // --- Monitor ---
    serverUnreachable: "Server is unreachable. Shutting down...",
    idleShutdownWarning: (minutes: number) =>
      `No players for ${minutes} ${minutes === 1 ? "minute" : "minutes"}. Shutting down in 2 minutes...`,
    shutdownCancelled: "Someone joined — shutdown cancelled.",
    autoStopped: "Server was automatically shut down due to inactivity.",
    playerJoined: (name: string) => `**${name}** joined the server`,
    playerLeft: (name: string) => `**${name}** left the server`,
    playersJoined: (count: number, current: number, max: number) =>
      `${count === 1 ? "1 player joined" : `${count} players joined`} (${current}/${max})`,
    playersLeft: (count: number, current: number, max: number) =>
      `${count === 1 ? "1 player left" : `${count} players left`} (${current}/${max})`,
    autoStopFailed: (error: string) =>
      `Automatic shutdown failed: ${error}`,
  },
  pl: {
    // --- Shared ---
    operationInProgress: (owner: string | null) =>
      owner
        ? `Operacja \`/${owner}\` jest już w toku.`
        : "Inna operacja jest już w toku.",

    // --- /start ---
    serverAlreadyRunning: "Serwer już działa.",
    noSnapshotsFound:
      "Nie znaleziono żadnego zapisu serwera. Nie można uruchomić serwera.",
    creatingServer: "Tworzę serwer...",
    dnsUpdateFailed: (ip: string) =>
      `Aktualizacja domeny nie powiodła się. Połącz się przez IP: \`${ip}\``,
    waitingForGame:
      "Serwer utworzony. Wczytuję ostatni zapis (to potrwa kilka minut)...",
    serverReady: (hostname: string) =>
      `Serwer gotowy! Połącz się z \`${hostname}\``,
    startFailed: (error: string) => `Nie udało się uruchomić serwera: ${error}`,

    // --- /stop ---
    noServerRunning: "Żaden serwer nie jest uruchomiony.",
    playersOnline: (count: number) =>
      `Nie można zatrzymać: na serwerze jest ${count} ${count === 1 ? "gracz" : "graczy"}.`,
    creatingSnapshot: "Zapisuję stan serwera...",
    snapshotFailed: "Zapis nie powiódł się, zostawiam serwer w spokoju.",
    playerJoinedDuringSnapshot:
      "Ktoś dołączył podczas zapisywania. Serwer pozostaje włączony.",
    deletingServer: "Serwer zapisana. Wyłączam...",
    serverStopped: "Serwer zatrzymany i zapisany.",
    stopFailed: (error: string) => `Nie udało się zatrzymać serwera: ${error}`,

    // --- /status ---
    serverOffline: "Serwer jest offline.",
    statusTitle: "Status",
    statusOnline: "Online",
    statusStarting: "Uruchamianie...",
    statusFailed: "Nie udało się pobrać statusu serwera.",
    statusFieldStatus: "Status",
    statusFieldUptime: "Czas działania",
    statusFieldPlayers: "Gracze",
    statusFieldOnlinePlayers: "Gracze online",

    // --- Monitor ---
    serverUnreachable: "Serwer jest nieosiągalny. Wyłączam...",
    idleShutdownWarning: (minutes: number) =>
      `Brak graczy od ${minutes} ${minutes === 1 ? "minuty" : "minut"}. Wyłączam za 2 minuty...`,
    shutdownCancelled: "Ktoś dołączył — wyłączanie anulowane.",
    autoStopped:
      "Serwer został automatycznie wyłączony z powodu braku aktywności.",
    playerJoined: (name: string) => `**${name}** dołączył do serwera`,
    playerLeft: (name: string) => `**${name}** opuścił serwer`,
    playersJoined: (count: number, current: number, max: number) =>
      `${count === 1 ? "Gracz dołączył" : `${count} graczy dołączyło`} (${current}/${max})`,
    playersLeft: (count: number, current: number, max: number) =>
      `${count === 1 ? "Gracz opuścił serwer" : `${count} graczy opuściło serwer`} (${current}/${max})`,
    autoStopFailed: (error: string) =>
      `Automatyczne wyłączenie nie powiodło się: ${error}`,
  },
} satisfies Record<Locale, unknown>;

export const msg = locales[locale];
export { locale };
