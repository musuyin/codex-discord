import pino, {
  type LevelWithSilent,
  type Logger,
  type LoggerOptions
} from "pino";

export function createLogger(level: LevelWithSilent = "info"): Logger {
  const options: LoggerOptions = {
    level,
    base: null,
    redact: { paths: ["token", "authorization", "headers.authorization", "req.headers.authorization", "*.token"], censor: "[REDACTED]" }
  };

  if (process.env.NODE_ENV !== "production") {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard"
      }
    };
  }

  return pino(options);
}
