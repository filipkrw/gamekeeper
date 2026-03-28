function timestamp(): string {
  return new Date().toISOString();
}

function formatValue(v: unknown): string {
  if (typeof v === "string") {
    return /[\s="{}[\]]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
  }
  return String(v);
}

function formatCtx(ctx?: Record<string, unknown>): string {
  if (!ctx) return "";
  const parts = Object.entries(ctx).map(([k, v]) => `${k}=${formatValue(v)}`);
  return parts.length ? " " + parts.join(" ") : "";
}

function write(level: string, msg: string, ctx?: Record<string, unknown>) {
  const line = `${timestamp()} ${level} ${msg}${formatCtx(ctx)}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export const log = {
  info(msg: string, ctx?: Record<string, unknown>) {
    write("INFO", msg, ctx);
  },
  warn(msg: string, ctx?: Record<string, unknown>) {
    write("WARN", msg, ctx);
  },
  error(msg: string, ctx?: Record<string, unknown>) {
    write("ERROR", msg, ctx);
  },
};
