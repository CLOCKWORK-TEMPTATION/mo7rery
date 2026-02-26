import pino, { type Logger } from "pino";
import { getTestConfig } from "./test-config-manager";

const createLogger = (): Logger => {
  try {
    const config = getTestConfig();
    const isPretty = process.env.NODE_ENV !== "production";

    const transport = isPretty
      ? pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
          },
        })
      : undefined;

    return pino(
      {
        level: config.TEST_LOG_LEVEL,
        base: {
          pid: undefined,
          hostname: undefined,
        },
      },
      transport
    );
  } catch {
    return pino({ level: "info" });
  }
};

const logger = createLogger();

export const logTestSuiteStart = (suiteName: string): void => {
  logger.info({ suiteName }, "test-suite-start");
};

export const logTestSuiteEnd = (
  suiteName: string,
  passed: number,
  failed: number,
  duration: number
): void => {
  logger.info({ suiteName, passed, failed, duration }, "test-suite-end");
};

export const logTestStep = (
  stepName: string,
  details?: Record<string, unknown>
): void => {
  logger.debug({ stepName, details }, "test-step");
};

export const logTestError = (testName: string, error: Error): void => {
  logger.error(
    {
      testName,
      message: error.message,
      stack: error.stack,
    },
    "test-error"
  );
};

export const getLogger = (): Logger => logger;
