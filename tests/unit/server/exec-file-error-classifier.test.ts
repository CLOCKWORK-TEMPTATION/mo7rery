import { describe, expect, it } from "vitest";
import { classifyExecFileError } from "../../../server/exec-file-error-classifier.mjs";

describe("exec-file-error-classifier", () => {
  it("classifies ENOENT as binary-missing", () => {
    const classified = classifyExecFileError(
      { code: "ENOENT", message: "spawn ENOENT" },
      "antiword",
      30_000
    );

    expect(classified.category).toBe("binary-missing");
    expect(classified.statusCode).toBe(422);
  });

  it("classifies EACCES as permission-denied", () => {
    const classified = classifyExecFileError(
      { code: "EACCES", message: "permission denied" },
      "antiword",
      30_000
    );

    expect(classified.category).toBe("permission-denied");
    expect(classified.statusCode).toBe(422);
  });

  it("classifies timeout and killed process as process-timeout", () => {
    const classified = classifyExecFileError(
      { code: "ETIMEDOUT", killed: true, signal: "SIGTERM" },
      "antiword",
      30_000
    );

    expect(classified.category).toBe("process-timeout");
    expect(classified.statusCode).toBe(504);
  });

  it("classifies non-zero exit code as non-zero-exit", () => {
    const classified = classifyExecFileError(
      { code: 2, message: "exit code 2" },
      "antiword",
      30_000
    );

    expect(classified.category).toBe("non-zero-exit");
    expect(classified.statusCode).toBe(422);
  });
});
