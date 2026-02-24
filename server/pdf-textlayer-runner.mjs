import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, extname, join } from "path";
import { fileURLToPath } from "url";

const PDF_TEXTLAYER_TIMEOUT_MS = 180_000;
const PDF_CONVERTER_MAX_BUFFER = 64 * 1024 * 1024;
const CLI_SCRIPTS_PATH = fileURLToPath(
  new URL("../src/cli.ts", import.meta.url)
);

const resolveTempPdfFilename = (filename) => {
  const base = basename(filename || "document.pdf");
  const hasPdfExt = extname(base).toLowerCase() === ".pdf";
  return hasPdfExt ? base : `${base}.pdf`;
};

const runPdfTextLayerScript = async (inputPdfPath, textOutputPath) =>
  new Promise((resolve, reject) => {
    const args = [
      "--import",
      "tsx",
      CLI_SCRIPTS_PATH,
      inputPdfPath,
      textOutputPath,
    ];

    execFile(
      process.execPath,
      args,
      {
        encoding: "buffer",
        timeout: PDF_TEXTLAYER_TIMEOUT_MS,
        maxBuffer: PDF_CONVERTER_MAX_BUFFER,
        windowsHide: true,
        env: {
          ...process.env,
        },
      },
      (error, stdout, stderr) => {
        const stdoutBuffer = Buffer.isBuffer(stdout)
          ? stdout
          : Buffer.from(stdout ?? "", "utf-8");
        const stderrBuffer = Buffer.isBuffer(stderr)
          ? stderr
          : Buffer.from(stderr ?? "", "utf-8");

        if (error) {
          const wrappedError = error;
          wrappedError.stdout = stdoutBuffer;
          wrappedError.stderr = stderrBuffer;
          reject(wrappedError);
          return;
        }

        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer });
      }
    );
  });

export const isPdfTextLayerScriptAvailable = () => existsSync(CLI_SCRIPTS_PATH);

export async function runPdfTextLayerFlow(buffer, filename) {
  const warnings = [];
  const attempts = ["pdf-textlayer-first"];
  const scriptPath = CLI_SCRIPTS_PATH;
  const startedAt = Date.now();

  if (!existsSync(scriptPath)) {
    throw new Error(`ملف المرفق غير موجود: ${scriptPath}`);
  }

  let tempDirPath = null;

  try {
    tempDirPath = await mkdtemp(join(tmpdir(), "pdf-textlayer-flow-runner-"));
    const inputPdfPath = join(tempDirPath, resolveTempPdfFilename(filename));
    const textOutputPath = join(tempDirPath, "script_output.txt");

    await writeFile(inputPdfPath, buffer);

    const { stdout, stderr } = await runPdfTextLayerScript(
      inputPdfPath,
      textOutputPath
    );

    let stdoutText = "";
    if (stdout) {
      stdoutText = new TextDecoder("utf-8").decode(stdout).trim();
    }
    let stderrText = "";
    if (stderr) {
      stderrText = new TextDecoder("utf-8").decode(stderr).trim();
    }

    if (stderrText) warnings.push(stderrText);

    let stats = null;
    let metadata = null;

    try {
      if (stdoutText) {
        const resultData = JSON.parse(stdoutText);
        if (resultData.stats) stats = resultData.stats;
        if (resultData.metadata) metadata = resultData.metadata;
        warnings.push(`Text Layer Extraction Stats: ${JSON.stringify(stats)}`);
      }
    } catch {
      warnings.push("Failed to parse script JSON output.");
      warnings.push(stdoutText);
    }

    const text = await readFile(textOutputPath, "utf-8");
    if (!text.trim()) {
      throw new Error("pdf-textlayer-first أعاد ملف TXT فارغًا");
    }

    // eslint-disable-next-line no-console
    console.info("[pdf-textlayer-flow-runner] success", {
      scriptPath,
      durationMs: Date.now() - startedAt,
      textLength: text.length,
      textOutputPath,
    });

    return {
      text,
      warnings,
      attempts,
      textOutputPath,
      stats,
      metadata,
    };
  } catch (error) {
    const err = error;

    let stdoutText = "";
    if (err?.stdout)
      stdoutText = new TextDecoder("utf-8").decode(err.stdout).trim();

    let stderrText = "";
    if (err?.stderr)
      stderrText = new TextDecoder("utf-8").decode(err.stderr).trim();

    if (stdoutText) warnings.push(stdoutText);
    if (stderrText) warnings.push(stderrText);

    console.error("[pdf-textlayer-flow-runner] failed", {
      scriptPath,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(error),
      warnings,
    });

    throw new Error(
      `فشل تحويل ملف PDF عبر textlayer API${
        warnings.length > 0 ? ` | ${warnings.join(" | ")}` : ""
      }`,
      {
        cause: error,
      }
    );
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => {
        // best effort cleanup
      });
    }
  }
}
