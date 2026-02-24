import { describe, it, expect, vi } from "vitest";
import { useHistory } from "@/hooks/use-history";

describe("useHistory", () => {
  it("should initialize with the correct state", () => {
    const history = useHistory({ count: 0 });
    expect(history.getState()).toEqual({ count: 0 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("should update state using a value", () => {
    const history = useHistory({ count: 0 });
    const newState = history.set({ count: 1 });

    expect(newState).toEqual({ count: 1 });
    expect(history.getState()).toEqual({ count: 1 });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it("should update state using a function", () => {
    const history = useHistory({ count: 0 });
    const newState = history.set((prev) => ({ count: prev.count + 1 }));

    expect(newState).toEqual({ count: 1 });
    expect(history.getState()).toEqual({ count: 1 });
  });

  it("should undo to the previous state", () => {
    const history = useHistory({ count: 0 });
    history.set({ count: 1 });
    history.set({ count: 2 });

    expect(history.getState()).toEqual({ count: 2 });
    expect(history.canUndo()).toBe(true);

    const undoneState = history.undo();
    expect(undoneState).toEqual({ count: 1 });
    expect(history.getState()).toEqual({ count: 1 });
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(true);

    history.undo();
    expect(history.getState()).toEqual({ count: 0 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it("should not undo past the initial state", () => {
    const history = useHistory({ count: 0 });
    const state = history.undo();

    expect(state).toEqual({ count: 0 });
    expect(history.getState()).toEqual({ count: 0 });
  });

  it("should redo to the next state", () => {
    const history = useHistory({ count: 0 });
    history.set({ count: 1 });
    history.set({ count: 2 });

    history.undo();
    history.undo();

    expect(history.getState()).toEqual({ count: 0 });

    const redoneState = history.redo();
    expect(redoneState).toEqual({ count: 1 });
    expect(history.getState()).toEqual({ count: 1 });
    expect(history.canRedo()).toBe(true);

    history.redo();
    expect(history.getState()).toEqual({ count: 2 });
    expect(history.canRedo()).toBe(false);
  });

  it("should not redo past the latest state", () => {
    const history = useHistory({ count: 0 });
    history.set({ count: 1 });

    const state = history.redo();
    expect(state).toEqual({ count: 1 });
    expect(history.getState()).toEqual({ count: 1 });
  });

  it("should clear future history when setting a new state after undo", () => {
    const history = useHistory({ count: 0 });
    history.set({ count: 1 });
    history.set({ count: 2 });

    history.undo(); // Back to { count: 1 }

    // Set new state, should clear { count: 2 }
    history.set({ count: 3 });

    expect(history.getState()).toEqual({ count: 3 });
    expect(history.canRedo()).toBe(false);

    history.undo();
    expect(history.getState()).toEqual({ count: 1 });
  });

  it("should notify subscribers on state change", () => {
    const history = useHistory({ count: 0 });
    const listener = vi.fn();

    history.subscribe(listener);

    // Should be called immediately with initial state
    expect(listener).toHaveBeenCalledWith({ count: 0 });
    expect(listener).toHaveBeenCalledTimes(1);

    history.set({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(2);

    history.undo();
    expect(listener).toHaveBeenCalledWith({ count: 0 });
    expect(listener).toHaveBeenCalledTimes(3);

    history.redo();
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("should allow unsubscribing", () => {
    const history = useHistory({ count: 0 });
    const listener = vi.fn();

    const unsubscribe = history.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    history.set({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
  });

  it("should handle unsubscribing a listener that is not in the list gracefully", () => {
    const history = useHistory({ count: 0 });
    const listener = vi.fn();

    const unsubscribe = history.subscribe(listener);

    // Unsubscribe twice
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});
