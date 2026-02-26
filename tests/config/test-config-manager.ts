import { config as loadDotEnv } from "dotenv";
import { ZodError, z } from "zod";

const testConfigSchema = z.object({
  NODE_ENV: z.literal("test"),
  TEST_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  TEST_LOG_FILE: z.string().min(1),
  MISTRAL_API_KEY: z.string().optional(),
  VITE_APP_PORT: z.coerce.number().int().min(1024).max(65535).default(5174),
  TEST_FIXTURES_DIR: z.string().default("./tests/fixtures"),
  TEST_TIMEOUT_MS: z.coerce.number().int().min(5000).default(30000),
});

export type TestConfig = z.infer<typeof testConfigSchema>;

class TestConfigManager {
  private static instance: TestConfigManager | null = null;

  private readonly testConfig: TestConfig;

  private constructor() {
    this.testConfig = this.loadAndValidate();
  }

  static getInstance(): TestConfigManager {
    if (!TestConfigManager.instance) {
      TestConfigManager.instance = new TestConfigManager();
    }
    return TestConfigManager.instance;
  }

  getConfig(): TestConfig {
    return this.testConfig;
  }

  private loadAndValidate(): TestConfig {
    try {
      loadDotEnv({ path: ".env.test", override: true });
      return testConfigSchema.parse(process.env);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = JSON.stringify(error.format(), null, 2);
        throw new Error(
          `Invalid test configuration in .env.test:\n${details}`,
          {
            cause: error,
          }
        );
      }

      if (error instanceof Error) {
        throw new Error("Failed to load test configuration.", {
          cause: error,
        });
      }

      throw error;
    }
  }
}

export const getTestConfig = (): TestConfig =>
  TestConfigManager.getInstance().getConfig();
