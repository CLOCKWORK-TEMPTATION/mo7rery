/**
 * @fileoverview Comprehensive tests for ContextMemoryManager
 * @module tests/unit/extensions/context-memory-manager.test
 *
 * يغطي هذا الملف اختبارات شاملة لمدير ذاكرة السياق:
 * - إدارة جلسات السياق
 * - تكامل localStorage
 * - تتبع كتل الحوار
 * - كشف الأنماط
 * - تصحيحات المستخدم
 * - سجلات التشغيل
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ContextMemoryManager,
  type LineRelation,
  type Correction,
  type EnhancedContextMemory,
} from "@/extensions/context-memory-manager";
import type {
  ClassifiedDraft,
  ClassificationRecord,
  ElementType,
} from "@/extensions/classification-types";

// ═══════════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════════

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: loggerMock,
}));

// LocalStorage mock
const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn(
    (key: string): string | null => localStorageStore[key] ?? null
  ),
  setItem: vi.fn((key: string, value: string): void => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string): void => {
    delete localStorageStore[key];
  }),
  clear: vi.fn((): void => {
    Object.keys(localStorageStore).forEach((key) => {
      delete localStorageStore[key];
    });
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_CHARACTER_NAMES = [
  "أحمد",
  "فاطمة",
  "أم أحمد",
  "أبو محمد",
  "الرجل العجوز",
  "الفتاة الصغيرة",
];

const SAMPLE_CLASSIFICATIONS: ClassificationRecord[] = [
  { line: "أحمد:", classification: "character" },
  { line: "مرحباً كيف حالك؟", classification: "dialogue" },
  { line: "سارة:", classification: "character" },
  { line: "بخير، شكراً لك", classification: "dialogue" },
];

const SAMPLE_DRAFT_ENTRIES: ClassifiedDraft[] = [
  { text: "أحمد:", type: "character", confidence: 0.95 },
  { text: "يدخل أحمد الغرفة", type: "action", confidence: 0.88 },
  { text: "مرحباً", type: "dialogue", confidence: 0.92 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe("ContextMemoryManager", () => {
  let manager: ContextMemoryManager;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach((key) => {
      delete localStorageStore[key];
    });

    // Setup localStorage mock
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    manager = new ContextMemoryManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Initialization
  // ════════════════════════════════════════════════════════════════════════════

  describe("Initialization", () => {
    it("should initialize with empty storage", () => {
      const snapshot = manager.getSnapshot();
      expect(snapshot.recentTypes).toEqual([]);
      expect(snapshot.characterFrequency.size).toBe(0);
    });

    it("should log initialization message", () => {
      expect(loggerMock.info).toHaveBeenCalledWith(
        "ContextMemoryManager initialized (enhanced).",
        { scope: "MemoryManager" }
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Session Context Management
  // ════════════════════════════════════════════════════════════════════════════

  describe("Session Context Management", () => {
    describe("loadContext", () => {
      it("should return null for non-existent session", async () => {
        const result = await manager.loadContext("non-existent-session");
        expect(result).toBeNull();
      });

      it("should return cached context without localStorage access", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        });

        localStorageMock.getItem.mockClear();
        const result = await manager.loadContext(sessionId);

        expect(result).not.toBeNull();
        expect(localStorageMock.getItem).not.toHaveBeenCalled();
      });

      it("should load from localStorage if not in cache", async () => {
        const sessionId = "persisted-session";
        const storedMemory: EnhancedContextMemory = {
          sessionId,
          lastModified: Date.now(),
          data: {
            commonCharacters: ["سارة"],
            commonLocations: [],
            lastClassifications: ["character", "dialogue"],
            characterDialogueMap: { سارة: 2 },
            dialogueBlocks: [],
            lineRelationships: [],
            userCorrections: [],
            confidenceMap: {},
          },
        };

        localStorageStore[`screenplay-memory-${sessionId}`] =
          JSON.stringify(storedMemory);

        // Create new manager to bypass in-memory cache
        const newManager = new ContextMemoryManager();
        const result = await newManager.loadContext(sessionId);

        expect(result).not.toBeNull();
        expect(result?.data.commonCharacters).toContain("سارة");
      });

      it("should return deep copy to prevent external mutation", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        });

        const result = await manager.loadContext(sessionId);
        result!.data.commonCharacters.push("محمود");

        const secondLoad = await manager.loadContext(sessionId);
        expect(secondLoad!.data.commonCharacters).not.toContain("محمود");
      });

      it("should enhance basic ContextMemory to EnhancedContextMemory", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: [],
            commonLocations: [],
            lastClassifications: [],
            characterDialogueMap: {},
          },
        });

        const result = await manager.loadContext(sessionId);

        expect(result).toHaveProperty("data.dialogueBlocks");
        expect(result).toHaveProperty("data.lineRelationships");
        expect(result).toHaveProperty("data.userCorrections");
        expect(result).toHaveProperty("data.confidenceMap");
      });
    });

    describe("saveContext", () => {
      it("should save to in-memory storage", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        });

        const result = await manager.loadContext(sessionId);
        expect(result).not.toBeNull();
        expect(result?.data.commonCharacters).toContain("أحمد");
      });

      it("should persist to localStorage", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["فاطمة"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { فاطمة: 1 },
          },
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          `screenplay-memory-${sessionId}`,
          expect.any(String)
        );
      });

      it("should create deep copy to prevent external mutation", async () => {
        const sessionId = "test-session";
        const memory = {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        };

        await manager.saveContext(sessionId, memory);
        memory.data.commonCharacters.push("محمود");

        const result = await manager.loadContext(sessionId);
        expect(result!.data.commonCharacters).not.toContain("محمود");
      });
    });

    describe("updateMemory", () => {
      it("should create new memory for new session", async () => {
        const sessionId = "new-session";
        await manager.updateMemory(sessionId, SAMPLE_CLASSIFICATIONS);

        const result = await manager.loadContext(sessionId);
        expect(result).not.toBeNull();
        expect(result?.data.lastClassifications.length).toBeGreaterThan(0);
      });

      it("should update existing memory", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        });

        await manager.updateMemory(sessionId, [
          { line: "سارة:", classification: "character" },
        ]);

        const result = await manager.loadContext(sessionId);
        expect(result?.data.commonCharacters).toContain("سارة");
      });

      it("should append classifications to lastClassifications", async () => {
        const sessionId = "test-session";
        await manager.updateMemory(
          sessionId,
          SAMPLE_CLASSIFICATIONS.slice(0, 2)
        );
        await manager.updateMemory(
          sessionId,
          SAMPLE_CLASSIFICATIONS.slice(2, 4)
        );

        const result = await manager.loadContext(sessionId);
        expect(result?.data.lastClassifications).toContain("character");
        expect(result?.data.lastClassifications).toContain("dialogue");
      });

      it("should respect MAX_RECENT_TYPES limit of 20", async () => {
        const sessionId = "test-session";
        const manyClassifications: ClassificationRecord[] = [];

        for (let i = 0; i < 30; i++) {
          manyClassifications.push({
            line: `line-${i}`,
            classification: "action" as ElementType,
          });
        }

        await manager.updateMemory(sessionId, manyClassifications);

        const result = await manager.loadContext(sessionId);
        expect(result?.data.lastClassifications.length).toBeLessThanOrEqual(20);
      });

      it("should track character names from character classifications", async () => {
        const sessionId = "test-session";
        await manager.updateMemory(sessionId, [
          { line: "أحمد:", classification: "character" },
          { line: "فاطمة:", classification: "character" },
        ]);

        const result = await manager.loadContext(sessionId);
        expect(result?.data.commonCharacters).toContain("أحمد");
        expect(result?.data.commonCharacters).toContain("فاطمة");
      });

      it("should ignore invalid character names", async () => {
        const sessionId = "test-session";
        await manager.updateMemory(sessionId, [
          { line: "أنا:", classification: "character" }, // Pronoun - invalid
          { line: "أحمد:", classification: "character" }, // Valid
        ]);

        const result = await manager.loadContext(sessionId);
        expect(result?.data.commonCharacters).not.toContain("أنا");
        expect(result?.data.commonCharacters).toContain("أحمد");
      });

      it("should increment character dialogue count", async () => {
        const sessionId = "test-session";
        await manager.updateMemory(sessionId, [
          { line: "أحمد:", classification: "character" },
          { line: "أحمد:", classification: "character" },
          { line: "أحمد:", classification: "character" },
        ]);

        const result = await manager.loadContext(sessionId);
        expect(result?.data.characterDialogueMap["أحمد"]).toBe(3);
      });

      it("should update lastModified timestamp", async () => {
        const sessionId = "test-session";
        const beforeTime = Date.now();

        await manager.updateMemory(sessionId, SAMPLE_CLASSIFICATIONS);

        const result = await manager.loadContext(sessionId);
        expect(result?.lastModified).toBeGreaterThanOrEqual(beforeTime);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. LocalStorage Integration
  // ════════════════════════════════════════════════════════════════════════════

  describe("LocalStorage Integration", () => {
    describe("saveToLocalStorage", () => {
      it("should not save if session not in storage", () => {
        manager.saveToLocalStorage("non-existent-session");
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
      });

      it("should save with correct key format", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: [],
            commonLocations: [],
            lastClassifications: [],
            characterDialogueMap: {},
          },
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          `screenplay-memory-${sessionId}`,
          expect.any(String)
        );
      });

      it("should serialize memory to JSON", async () => {
        const sessionId = "test-session";
        await manager.saveContext(sessionId, {
          sessionId,
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
          },
        });

        const savedValue = localStorageStore[`screenplay-memory-${sessionId}`];
        const parsed = JSON.parse(savedValue);
        expect(parsed.data.commonCharacters).toContain("أحمد");
      });
    });

    describe("loadFromLocalStorage", () => {
      it("should return null for non-existent key", () => {
        const result = manager.loadFromLocalStorage("non-existent");
        expect(result).toBeNull();
      });

      it("should parse JSON from localStorage", () => {
        const sessionId = "stored-session";
        const storedMemory: EnhancedContextMemory = {
          sessionId,
          lastModified: Date.now(),
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
            dialogueBlocks: [],
            lineRelationships: [],
            userCorrections: [],
            confidenceMap: {},
          },
        };

        localStorageStore[`screenplay-memory-${sessionId}`] =
          JSON.stringify(storedMemory);

        const result = manager.loadFromLocalStorage(sessionId);
        expect(result?.data.commonCharacters).toContain("أحمد");
      });

      it("should enhance loaded memory with missing fields", () => {
        const sessionId = "legacy-session";
        // Simulate legacy memory without enhanced fields
        const legacyMemory = {
          sessionId,
          lastModified: Date.now(),
          data: {
            commonCharacters: ["أحمد"],
            commonLocations: [],
            lastClassifications: ["character"],
            characterDialogueMap: { أحمد: 1 },
            // Missing: dialogueBlocks, lineRelationships, userCorrections, confidenceMap
          },
        };

        localStorageStore[`screenplay-memory-${sessionId}`] =
          JSON.stringify(legacyMemory);

        const result = manager.loadFromLocalStorage(sessionId);

        expect(result?.data.dialogueBlocks).toEqual([]);
        expect(result?.data.lineRelationships).toEqual([]);
        expect(result?.data.userCorrections).toEqual([]);
        expect(result?.data.confidenceMap).toEqual({});
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. Dialogue Block Tracking
  // ════════════════════════════════════════════════════════════════════════════

  describe("Dialogue Block Tracking", () => {
    const sessionId = "test-session";

    beforeEach(async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });
    });

    it("should add dialogue block to memory", () => {
      manager.trackDialogueBlock(sessionId, "أحمد", 1, 5);

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.dialogueBlocks.length).toBe(1);
      expect(result?.data.dialogueBlocks[0]?.character).toBe("أحمد");
    });

    it("should calculate lineCount from startLine and endLine", () => {
      manager.trackDialogueBlock(sessionId, "سارة", 10, 15);

      const result = manager.loadFromLocalStorage(sessionId);
      const block = result?.data.dialogueBlocks[0];
      expect(block?.lineCount).toBe(6); // 15 - 10 + 1
    });

    it("should not track if session not in storage", () => {
      manager.trackDialogueBlock("non-existent", "أحمد", 1, 5);

      const result = manager.loadFromLocalStorage("non-existent");
      expect(result).toBeNull();
    });

    it("should limit dialogue blocks to 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        manager.trackDialogueBlock(sessionId, `شخصية-${i}`, i, i + 2);
      }

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.dialogueBlocks.length).toBeLessThanOrEqual(50);
    });

    it("should keep most recent 50 when limit exceeded", () => {
      for (let i = 0; i < 60; i++) {
        manager.trackDialogueBlock(sessionId, `شخصية-${i}`, i, i + 2);
      }

      const result = manager.loadFromLocalStorage(sessionId);
      const blocks = result?.data.dialogueBlocks ?? [];

      // Should keep the last 50 (indices 10-59)
      expect(blocks[0]?.character).toBe("شخصية-10");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Line Relationships
  // ════════════════════════════════════════════════════════════════════════════

  describe("Line Relationships", () => {
    const sessionId = "test-session";

    beforeEach(async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });
    });

    it("should add line relation to memory", () => {
      const relation: LineRelation = {
        previousLine: "أحمد:",
        currentLine: "مرحباً",
        relationType: "follows",
      };

      manager.addLineRelation(sessionId, relation);

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.lineRelationships.length).toBe(1);
      expect(result?.data.lineRelationships[0]?.relationType).toBe("follows");
    });

    it("should not add if session not in storage", () => {
      const relation: LineRelation = {
        previousLine: "أحمد:",
        currentLine: "مرحباً",
        relationType: "follows",
      };

      manager.addLineRelation("non-existent", relation);

      const result = manager.loadFromLocalStorage("non-existent");
      expect(result).toBeNull();
    });

    it("should limit line relationships to 200 entries", () => {
      for (let i = 0; i < 250; i++) {
        manager.addLineRelation(sessionId, {
          previousLine: `line-${i}`,
          currentLine: `line-${i + 1}`,
          relationType: "follows",
        });
      }

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.lineRelationships.length).toBeLessThanOrEqual(200);
    });

    it("should keep most recent 200 when limit exceeded", () => {
      for (let i = 0; i < 250; i++) {
        manager.addLineRelation(sessionId, {
          previousLine: `line-${i}`,
          currentLine: `line-${i + 1}`,
          relationType: "follows",
        });
      }

      const result = manager.loadFromLocalStorage(sessionId);
      const relations = result?.data.lineRelationships ?? [];

      // Should keep the last 200 (indices 50-249)
      expect(relations[0]?.previousLine).toBe("line-50");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Pattern Detection
  // ════════════════════════════════════════════════════════════════════════════

  describe("Pattern Detection", () => {
    const sessionId = "test-session";

    it("should return null for non-existent session", () => {
      const pattern = manager.detectPattern("non-existent");
      expect(pattern).toBeNull();
    });

    it("should return null for empty classifications", async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });

      const pattern = manager.detectPattern(sessionId);
      expect(pattern).toBeNull();
    });

    it("should return null for less than 4 classifications", async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: ["character", "dialogue"],
          characterDialogueMap: {},
        },
      });

      const pattern = manager.detectPattern(sessionId);
      expect(pattern).toBeNull();
    });

    it("should detect repeated pair pattern", async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [
            "character",
            "dialogue",
            "character",
            "dialogue",
            "character",
            "dialogue",
          ],
          characterDialogueMap: {},
        },
      });

      const pattern = manager.detectPattern(sessionId);
      expect(pattern).toBe("character-dialogue");
    });

    it("should return most frequent pattern with count >= 2", async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [
            "action",
            "action",
            "character",
            "dialogue",
            "character",
            "dialogue",
          ],
          characterDialogueMap: {},
        },
      });

      const pattern = manager.detectPattern(sessionId);
      expect(pattern).toBe("character-dialogue");
    });

    it("should try reversed order if no pattern in original order", async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [
            "dialogue",
            "character",
            "dialogue",
            "character",
            "dialogue",
            "character",
          ],
          characterDialogueMap: {},
        },
      });

      const pattern = manager.detectPattern(sessionId);
      // Reversed order would find character-dialogue pattern
      expect(pattern).not.toBeNull();
    });

    it("should load from localStorage if not in memory", async () => {
      const storedMemory: EnhancedContextMemory = {
        sessionId,
        lastModified: Date.now(),
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [
            "character",
            "dialogue",
            "character",
            "dialogue",
          ],
          characterDialogueMap: {},
          dialogueBlocks: [],
          lineRelationships: [],
          userCorrections: [],
          confidenceMap: {},
        },
      };

      localStorageStore[`screenplay-memory-${sessionId}`] =
        JSON.stringify(storedMemory);

      // Create new manager without in-memory cache
      const newManager = new ContextMemoryManager();
      const pattern = newManager.detectPattern(sessionId);

      expect(pattern).toBe("character-dialogue");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. User Corrections
  // ════════════════════════════════════════════════════════════════════════════

  describe("User Corrections", () => {
    const sessionId = "test-session";

    beforeEach(async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });
    });

    it("should add correction to memory", () => {
      const correction: Correction = {
        line: "أحمد:",
        originalClassification: "action",
        newClassification: "character",
        timestamp: Date.now(),
      };

      manager.addUserCorrection(sessionId, correction);

      const corrections = manager.getUserCorrections(sessionId);
      expect(corrections.length).toBe(1);
      expect(corrections[0]?.newClassification).toBe("character");
    });

    it("should not add if session not in storage", () => {
      const correction: Correction = {
        line: "أحمد:",
        originalClassification: "action",
        newClassification: "character",
        timestamp: Date.now(),
      };

      manager.addUserCorrection("non-existent", correction);

      const corrections = manager.getUserCorrections("non-existent");
      expect(corrections).toEqual([]);
    });

    it("should limit corrections to 200 entries", () => {
      for (let i = 0; i < 250; i++) {
        manager.addUserCorrection(sessionId, {
          line: `line-${i}`,
          originalClassification: "action",
          newClassification: "character",
          timestamp: i,
        });
      }

      const corrections = manager.getUserCorrections(sessionId);
      expect(corrections.length).toBeLessThanOrEqual(200);
    });

    it("should keep most recent 200 when limit exceeded", () => {
      for (let i = 0; i < 250; i++) {
        manager.addUserCorrection(sessionId, {
          line: `line-${i}`,
          originalClassification: "action",
          newClassification: "character",
          timestamp: i,
        });
      }

      const corrections = manager.getUserCorrections(sessionId);
      // Should keep the last 200 (indices 50-249)
      expect(corrections[0]?.line).toBe("line-50");
    });

    it("should return empty array for non-existent session", () => {
      const corrections = manager.getUserCorrections("non-existent");
      expect(corrections).toEqual([]);
    });

    it("should return copy of corrections array", async () => {
      manager.addUserCorrection(sessionId, {
        line: "test",
        originalClassification: "action",
        newClassification: "character",
        timestamp: 1,
      });

      const corrections1 = manager.getUserCorrections(sessionId);
      corrections1.push({
        line: "fake",
        originalClassification: "fake",
        newClassification: "fake",
        timestamp: 0,
      });

      const corrections2 = manager.getUserCorrections(sessionId);
      expect(corrections2.length).toBe(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 8. Confidence Tracking
  // ════════════════════════════════════════════════════════════════════════════

  describe("Confidence Tracking", () => {
    const sessionId = "test-session";

    beforeEach(async () => {
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });
    });

    it("should update confidence for a line", () => {
      manager.updateConfidence(sessionId, "أحمد:", 0.95);

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.confidenceMap["أحمد:"]).toBe(0.95);
    });

    it("should not update if session not in storage", () => {
      manager.updateConfidence("non-existent", "test", 0.5);

      const result = manager.loadFromLocalStorage("non-existent");
      expect(result).toBeNull();
    });

    it("should persist after update", () => {
      manager.updateConfidence(sessionId, "test-line", 0.88);

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result?.data.confidenceMap["test-line"]).toBe(0.88);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 9. Runtime Records
  // ════════════════════════════════════════════════════════════════════════════

  describe("Runtime Records", () => {
    describe("record", () => {
      it("should add entry to runtime records", () => {
        manager.record(SAMPLE_DRAFT_ENTRIES[0]!);

        const snapshot = manager.getSnapshot();
        expect(snapshot.recentTypes).toContain("character");
      });

      it("should limit runtime records to 120 entries", () => {
        for (let i = 0; i < 150; i++) {
          manager.record({
            text: `line-${i}`,
            type: "action",
            confidence: 0.8,
          });
        }

        const snapshot = manager.getSnapshot();
        expect(snapshot.recentTypes.length).toBeLessThanOrEqual(20);
      });

      it("should update runtime memory lastClassifications", () => {
        manager.record({ text: "test", type: "dialogue", confidence: 0.9 });

        const snapshot = manager.getSnapshot();
        expect(snapshot.recentTypes).toContain("dialogue");
      });

      it("should track character from character type entries", () => {
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });

        const snapshot = manager.getSnapshot();
        expect(snapshot.characterFrequency.has("أحمد")).toBe(true);
      });

      it("should ignore invalid character names", () => {
        manager.record({ text: "أنا:", type: "character", confidence: 0.95 });

        const snapshot = manager.getSnapshot();
        expect(snapshot.characterFrequency.has("أنا")).toBe(false);
      });

      it("should update character dialogue map", () => {
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });

        const snapshot = manager.getSnapshot();
        expect(snapshot.characterFrequency.get("أحمد")).toBe(3);
      });
    });

    describe("replaceLast", () => {
      it("should replace last entry in runtime records", () => {
        manager.record({ text: "original", type: "action", confidence: 0.8 });
        manager.replaceLast({
          text: "replaced",
          type: "dialogue",
          confidence: 0.9,
        });

        const snapshot = manager.getSnapshot();
        expect(snapshot.recentTypes).toContain("dialogue");
        expect(snapshot.recentTypes).not.toContain("action");
      });

      it("should call record if runtime records empty", () => {
        manager.replaceLast({ text: "first", type: "action", confidence: 0.8 });

        const snapshot = manager.getSnapshot();
        expect(snapshot.recentTypes).toContain("action");
      });

      it("should rebuild aggregates after replacement", () => {
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });
        manager.record({ text: "سارة:", type: "character", confidence: 0.95 });
        manager.replaceLast({
          text: "محمد:",
          type: "character",
          confidence: 0.95,
        });

        const snapshot = manager.getSnapshot();
        expect(snapshot.characterFrequency.has("أحمد")).toBe(true);
        expect(snapshot.characterFrequency.has("محمد")).toBe(true);
        expect(snapshot.characterFrequency.has("سارة")).toBe(false);
      });

      it("should correctly recalculate character frequencies", () => {
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });
        manager.record({ text: "سارة:", type: "character", confidence: 0.95 });

        // Replace last (سارة) with أحمد
        manager.replaceLast({
          text: "أحمد:",
          type: "character",
          confidence: 0.95,
        });

        const snapshot = manager.getSnapshot();
        expect(snapshot.characterFrequency.get("أحمد")).toBe(3);
        expect(snapshot.characterFrequency.has("سارة")).toBe(false);
      });
    });

    describe("getSnapshot", () => {
      it("should return read-only snapshot", () => {
        manager.record({ text: "test", type: "action", confidence: 0.8 });

        const snapshot = manager.getSnapshot();

        expect(snapshot.recentTypes).toBeInstanceOf(Array);
        expect(snapshot.characterFrequency).toBeInstanceOf(Map);
      });

      it("should include recentTypes array", () => {
        manager.record({ text: "test1", type: "action", confidence: 0.8 });
        manager.record({ text: "test2", type: "dialogue", confidence: 0.9 });

        const snapshot = manager.getSnapshot();

        expect(snapshot.recentTypes).toContain("action");
        expect(snapshot.recentTypes).toContain("dialogue");
      });

      it("should include characterFrequency map", () => {
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });

        const snapshot = manager.getSnapshot();

        expect(snapshot.characterFrequency.get("أحمد")).toBe(1);
      });

      it("should filter out invalid frequency values", () => {
        // Record a valid character
        manager.record({ text: "أحمد:", type: "character", confidence: 0.95 });

        const snapshot = manager.getSnapshot();

        // All frequencies should be positive
        snapshot.characterFrequency.forEach((count) => {
          expect(count).toBeGreaterThan(0);
          expect(Number.isFinite(count)).toBe(true);
        });
      });

      it("should work with empty runtime memory", () => {
        const snapshot = manager.getSnapshot();

        expect(snapshot.recentTypes).toEqual([]);
        expect(snapshot.characterFrequency.size).toBe(0);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 10. Character Validation
  // ════════════════════════════════════════════════════════════════════════════

  describe("Character Validation", () => {
    it("should reject names shorter than 2 characters", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "أ:", classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).not.toContain("أ");
    });

    it("should reject names longer than 40 characters", async () => {
      const sessionId = "test-session";
      const longName = "أ".repeat(41);
      await manager.updateMemory(sessionId, [
        { line: `${longName}:`, classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).not.toContain(longName);
    });

    it("should reject names with punctuation marks", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "أحمد؟:", classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).not.toContain("أحمد؟");
    });

    it("should reject single-token pronouns", async () => {
      const sessionId = "test-session";

      for (const pronoun of ["أنا", "أنت", "هو", "هي", "هم", "هن"]) {
        await manager.updateMemory(sessionId, [
          { line: `${pronoun}:`, classification: "character" },
        ]);
      }

      const result = await manager.loadContext(sessionId);
      for (const pronoun of ["أنا", "أنت", "هو", "هي", "هم", "هن"]) {
        expect(result?.data.commonCharacters).not.toContain(pronoun);
      }
    });

    it("should accept valid Arabic names", async () => {
      const sessionId = "test-session";

      for (const name of VALID_CHARACTER_NAMES) {
        await manager.updateMemory(sessionId, [
          { line: `${name}:`, classification: "character" },
        ]);
      }

      const result = await manager.loadContext(sessionId);
      for (const name of VALID_CHARACTER_NAMES) {
        expect(result?.data.commonCharacters).toContain(name);
      }
    });

    it("should accept compound names", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "أم أحمد:", classification: "character" },
        { line: "أبو محمد:", classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).toContain("أم أحمد");
      expect(result?.data.commonCharacters).toContain("أبو محمد");
    });

    it("should normalize names before validation", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "  أحمد:  ", classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).toContain("أحمد");
    });

    it("should reject names with more than 5 tokens", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        {
          line: "واحد اثنين ثلاثة أربعة خمسة ستة:",
          classification: "character",
        },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters.length).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 11. Edge Cases
  // ════════════════════════════════════════════════════════════════════════════

  describe("Edge Cases", () => {
    it("should handle empty classifications array", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, []);

      const result = await manager.loadContext(sessionId);
      expect(result).not.toBeNull();
    });

    it("should handle all non-character classifications", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "يدخل أحمد الغرفة", classification: "action" },
        { line: "مرحباً", classification: "dialogue" },
        { line: "(مبتسماً)", classification: "parenthetical" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters.length).toBe(0);
    });

    it("should handle special characters in session IDs", async () => {
      const sessionId = "session-with-special-chars-!@#$%";
      await manager.saveContext(sessionId, {
        sessionId,
        data: {
          commonCharacters: [],
          commonLocations: [],
          lastClassifications: [],
          characterDialogueMap: {},
        },
      });

      const result = await manager.loadContext(sessionId);
      expect(result).not.toBeNull();
    });

    it("should handle very long character names at boundary", async () => {
      const sessionId = "test-session";
      const boundaryName = "أ".repeat(40); // Exactly 40 chars

      await manager.updateMemory(sessionId, [
        { line: `${boundaryName}:`, classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      expect(result?.data.commonCharacters).toContain(boundaryName);
    });

    it("should handle concurrent session operations", async () => {
      const sessions = ["session-1", "session-2", "session-3"];

      await Promise.all(
        sessions.map((sessionId) =>
          manager.saveContext(sessionId, {
            sessionId,
            data: {
              commonCharacters: [sessionId],
              commonLocations: [],
              lastClassifications: [],
              characterDialogueMap: {},
            },
          })
        )
      );

      for (const sessionId of sessions) {
        const result = await manager.loadContext(sessionId);
        expect(result?.data.commonCharacters).toContain(sessionId);
      }
    });

    it("should handle corrupted localStorage data gracefully", () => {
      const sessionId = "corrupted-session";
      localStorageStore[`screenplay-memory-${sessionId}`] = "not-valid-json{{{";

      const result = manager.loadFromLocalStorage(sessionId);
      expect(result).toBeNull();
    });

    it("should handle missing window.localStorage", async () => {
      Object.defineProperty(window, "localStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Should not throw
      const newManager = new ContextMemoryManager();
      expect(newManager).toBeInstanceOf(ContextMemoryManager);
    });

    it("should handle RTL text in character names correctly", async () => {
      const sessionId = "test-session";
      await manager.updateMemory(sessionId, [
        { line: "\u200Fأحمد\u200E:", classification: "character" },
      ]);

      const result = await manager.loadContext(sessionId);
      // Should normalize and store without invisible chars
      expect(result?.data.commonCharacters).toContain("أحمد");
    });
  });
});
