import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useAutoSave,
  loadFromStorage,
  saveToStorage,
} from "@/hooks/use-local-storage";

describe("use-local-storage", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe("loadFromStorage", () => {
    it("should return the default value if key does not exist", () => {
      const result = loadFromStorage("non-existent-key", "default-value");
      expect(result).toBe("default-value");
    });

    it("should return the parsed value if key exists", () => {
      window.localStorage.setItem(
        "existing-key",
        JSON.stringify({ foo: "bar" })
      );
      const result = loadFromStorage("existing-key", { default: true });
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return the default value if JSON parsing fails", () => {
      window.localStorage.setItem("invalid-json-key", "invalid-json");
      const result = loadFromStorage("invalid-json-key", "default-value");
      expect(result).toBe("default-value");
    });

    it("should return default value if window is undefined", () => {
      const originalWindow = global.window;
      // @ts-expect-error test simulates missing global window
      delete global.window;

      const result = loadFromStorage("any-key", "default-value");
      expect(result).toBe("default-value");

      global.window = originalWindow;
    });
  });

  describe("saveToStorage", () => {
    it("should save the value to localStorage as JSON", () => {
      saveToStorage("test-key", { foo: "bar" });
      const storedValue = window.localStorage.getItem("test-key");
      expect(storedValue).toBe(JSON.stringify({ foo: "bar" }));
    });

    it("should not throw if window is undefined", () => {
      const originalWindow = global.window;
      // @ts-expect-error test simulates missing global window
      delete global.window;

      expect(() => saveToStorage("test-key", "value")).not.toThrow();

      global.window = originalWindow;
    });

    it("should handle storage errors gracefully", () => {
      const setItemSpy = vi
        .spyOn(window.localStorage, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });

      expect(() => saveToStorage("test-key", "value")).not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe("useAutoSave", () => {
    it("should save the value after the specified delay", () => {
      useAutoSave("auto-save-key", "test-value", 1000);

      // Value should not be saved immediately
      expect(window.localStorage.getItem("auto-save-key")).toBeNull();

      // Fast-forward time by 500ms
      vi.advanceTimersByTime(500);
      expect(window.localStorage.getItem("auto-save-key")).toBeNull();

      // Fast-forward time by another 500ms
      vi.advanceTimersByTime(500);
      expect(window.localStorage.getItem("auto-save-key")).toBe(
        JSON.stringify("test-value")
      );
    });

    it("should use the default delay of 3000ms if not specified", () => {
      useAutoSave("auto-save-key-default", "test-value");

      vi.advanceTimersByTime(2999);
      expect(window.localStorage.getItem("auto-save-key-default")).toBeNull();

      vi.advanceTimersByTime(1);
      expect(window.localStorage.getItem("auto-save-key-default")).toBe(
        JSON.stringify("test-value")
      );
    });

    it("should debounce multiple calls and only save the last value", () => {
      useAutoSave("debounce-key", "value-1", 1000);

      vi.advanceTimersByTime(500);

      // Call again before the first timeout completes
      useAutoSave("debounce-key", "value-2", 1000);

      // Fast-forward time by 500ms (total 1000ms since first call)
      vi.advanceTimersByTime(500);

      // The first call should have been cancelled, so nothing is saved yet
      expect(window.localStorage.getItem("debounce-key")).toBeNull();

      // Fast-forward time by another 500ms (total 1000ms since second call)
      vi.advanceTimersByTime(500);

      // Now the second value should be saved
      expect(window.localStorage.getItem("debounce-key")).toBe(
        JSON.stringify("value-2")
      );
    });

    it("should not do anything if window is undefined", () => {
      const originalWindow = global.window;
      // @ts-expect-error test simulates missing global window
      delete global.window;

      expect(() => useAutoSave("test-key", "value")).not.toThrow();

      global.window = originalWindow;
    });
  });
});
