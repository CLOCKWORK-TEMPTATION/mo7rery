import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, type LogContext } from "@/utils/logger";

let consoleSpy: {
  info: ReturnType<typeof vi.spyOn>;
  warn: ReturnType<typeof vi.spyOn>;
  error: ReturnType<typeof vi.spyOn>;
  debug: ReturnType<typeof vi.spyOn>;
};

describe("Logger Utility", () => {
  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, "info"),
      warn: vi.spyOn(console, "warn"),
      error: vi.spyOn(console, "error"),
      debug: vi.spyOn(console, "debug"),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logger.info", () => {
    it("should log info messages with timestamp", () => {
      const message = "Test info message";

      logger.info(message);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Test info message"),
        ""
      );

      // Check that it includes a timestamp
      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/
      );
    });

    it("should include scope when provided", () => {
      const message = "Test message";
      const context: LogContext = { scope: "test-scope" };

      logger.info(message, context);

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain("[test-scope]");
      expect(loggedMessage).toContain("Test message");
    });

    it("should include data when provided", () => {
      const message = "Test message";
      const context: LogContext = { data: { key: "value" } };

      logger.info(message, context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Test message"),
        { key: "value" }
      );
    });

    it("should include tags when provided", () => {
      const message = "Test message";
      const context: LogContext = { tags: ["tag1", "tag2"] };

      logger.info(message, context);

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain("tags=tag1,tag2");
    });
  });

  describe("logger.warn", () => {
    it("should log warning messages", () => {
      const message = "Test warning message";

      logger.warn(message);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("Test warning message"),
        ""
      );
    });

    it("should include scope and data for warnings", () => {
      const message = "Warning message";
      const context: LogContext = {
        scope: "warning-scope",
        data: { code: 404 },
      };

      logger.warn(message, context);

      const loggedMessage = consoleSpy.warn.mock.calls[0][0];
      expect(loggedMessage).toContain("[warning-scope]");
      expect(loggedMessage).toContain("Warning message");
      expect(consoleSpy.warn).toHaveBeenCalledWith(loggedMessage, {
        code: 404,
      });
    });
  });

  describe("logger.error", () => {
    it("should log error messages", () => {
      const message = "Test error message";

      logger.error(message);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Test error message"),
        ""
      );
    });

    it("should format Error objects in data", () => {
      const message = "Error occurred";
      const error = new Error("Test error");
      const context: LogContext = { data: error };

      logger.error(message, context);

      const loggedPayload = consoleSpy.error.mock.calls[0][1];
      expect(loggedPayload).toEqual({
        name: "Error",
        message: "Test error",
        stack: error.stack,
      });
    });
  });

  describe("logger.debug", () => {
    it("should respect the current DEV build flag", () => {
      const message = "Test debug message";

      logger.debug(message);

      if (import.meta.env.DEV) {
        expect(consoleSpy.debug).toHaveBeenCalledWith(
          expect.stringContaining("Test debug message"),
          ""
        );
      } else {
        expect(consoleSpy.debug).not.toHaveBeenCalled();
      }
    });
  });

  describe("logger.telemetry", () => {
    it('should log telemetry events with "telemetry:" prefix', () => {
      const event = "file.import.success";
      const data = { duration: 100 };

      logger.telemetry(event, data);

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain("telemetry:file.import.success");
      expect(consoleSpy.info).toHaveBeenCalledWith(loggedMessage, data);
    });

    it("should include scope in telemetry logs", () => {
      const event = "pipeline.completed";
      const data = { steps: 5 };
      const context: LogContext = { scope: "pipeline" };

      logger.telemetry(event, data, context);

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain("[pipeline]");
      expect(loggedMessage).toContain("telemetry:pipeline.completed");
    });
  });

  describe("logger.createScope", () => {
    it("should create a scoped logger with all methods", () => {
      const scopedLogger = logger.createScope("my-scope");

      expect(typeof scopedLogger.info).toBe("function");
      expect(typeof scopedLogger.warn).toBe("function");
      expect(typeof scopedLogger.error).toBe("function");
      expect(typeof scopedLogger.debug).toBe("function");
      expect(typeof scopedLogger.telemetry).toBe("function");
    });

    it("should automatically prepend scope to all log messages", () => {
      const scopedLogger = logger.createScope("my-scope");

      scopedLogger.info("Info message", { key: "value" });

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).toContain("[my-scope]");
      expect(loggedMessage).toContain("Info message");
      expect(consoleSpy.info).toHaveBeenCalledWith(loggedMessage, {
        key: "value",
      });
    });

    it("should work with all scoped methods", () => {
      const scopedLogger = logger.createScope("scoped-test");

      scopedLogger.info("Info message");
      scopedLogger.warn("Warn message");
      scopedLogger.error("Error message");
      scopedLogger.debug("Debug message");
      scopedLogger.telemetry("event", { data: "test" });

      expect(consoleSpy.info).toHaveBeenCalledTimes(2); // info + telemetry
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);

      // Each call should include the scope
      consoleSpy.info.mock.calls.forEach((call) => {
        expect(call[0]).toContain("[scoped-test]");
      });
      consoleSpy.warn.mock.calls.forEach((call) => {
        expect(call[0]).toContain("[scoped-test]");
      });
      consoleSpy.error.mock.calls.forEach((call) => {
        expect(call[0]).toContain("[scoped-test]");
      });
      consoleSpy.debug.mock.calls.forEach((call) => {
        expect(call[0]).toContain("[scoped-test]");
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle null/undefined data gracefully", () => {
      logger.info("Test message", { data: null });
      logger.info("Test message", { data: undefined });

      expect(consoleSpy.info).toHaveBeenCalledTimes(2);
    });

    it("should handle empty tags array", () => {
      logger.info("Test message", { tags: [] });

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain("tags=");
    });

    it("should handle falsy scope", () => {
      logger.info("Test message", { scope: "" });

      const loggedMessage = consoleSpy.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain("[]");
    });
  });
});
