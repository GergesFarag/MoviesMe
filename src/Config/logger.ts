import pino from "pino";
import AppError from "../Utils/Errors/AppError";
const LOG_LEVEL = process.env.NODE_ENV === "development" ? "debug" : "info";
const baseOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
};

function createLogger() {
  if (process.env.NODE_ENV === "development") {
    try {
      require.resolve("pino-pretty");
      return pino({
        ...baseOptions,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      });
    } catch (_err) {
      throw new AppError(_err instanceof Error ? _err.message : "Unknown error", 500);
    }
  }
  return pino(baseOptions);
}

const logger = createLogger();

export default logger;