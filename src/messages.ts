// All user-facing Discord messages in one place for easy editing.

export const msg = {
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
    "Ktoś dołączył podczas zapisywania — wyłączanie anulowane. Serwer pozostaje włączony.",
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
};
