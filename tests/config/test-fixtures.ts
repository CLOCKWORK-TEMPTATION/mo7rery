import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getTestConfig } from "./test-config-manager";
import { logTestError } from "./test-logger";

class TestFixtureLoader {
  private readonly baseDir: string;

  constructor() {
    const config = getTestConfig();
    this.baseDir = resolve(process.cwd(), config.TEST_FIXTURES_DIR);
  }

  async loadFixture(name: string): Promise<string[]> {
    try {
      const raw = await this.loadRawFixture(name);
      return raw.split(/\r?\n/);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logTestError(`loadFixture:${name}`, err);
      throw err;
    }
  }

  async loadRawFixture(name: string): Promise<string> {
    try {
      const fileName = name.endsWith(".txt") ? name : `${name}.txt`;
      const filePath = resolve(this.baseDir, fileName);
      return await readFile(filePath, "utf-8");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logTestError(`loadRawFixture:${name}`, err);
      throw err;
    }
  }
}

const loader = new TestFixtureLoader();

export const loadFixture = async (name: string): Promise<string[]> =>
  loader.loadFixture(name);

export const loadRawFixture = async (name: string): Promise<string> =>
  loader.loadRawFixture(name);

export { TestFixtureLoader };
