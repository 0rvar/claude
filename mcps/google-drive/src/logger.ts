const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

function resolveLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return "info";
}

const currentLevel = resolveLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(...args: unknown[]) {
    if (shouldLog("debug")) console.error("[DEBUG]", ...args);
  },
  info(...args: unknown[]) {
    if (shouldLog("info")) console.error("[INFO]", ...args);
  },
  warn(...args: unknown[]) {
    if (shouldLog("warn")) console.error("[WARN]", ...args);
  },
  error(...args: unknown[]) {
    if (shouldLog("error")) console.error("[ERROR]", ...args);
  },
};
