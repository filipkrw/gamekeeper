function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info(msg: string, ctx?: Record<string, unknown>) {
    console.log(`[${timestamp()}] INFO: ${msg}`, ctx ?? "");
  },
  warn(msg: string, ctx?: Record<string, unknown>) {
    console.warn(`[${timestamp()}] WARN: ${msg}`, ctx ?? "");
  },
  error(msg: string, ctx?: Record<string, unknown>) {
    console.error(`[${timestamp()}] ERROR: ${msg}`, ctx ?? "");
  },
};
