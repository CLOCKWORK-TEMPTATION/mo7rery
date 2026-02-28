import type { ScreenplayBlock } from "../../utils/file-import/document-model";

export type UnstructuredItemType =
  | "BASMALA"
  | "SCENE-HEADER-1"
  | "SCENE-HEADER-2"
  | "SCENE-HEADER-3"
  | "ACTION"
  | "CHARACTER"
  | "DIALOGUE"
  | "TRANSITION";

export type UnstructuredOpType =
  | "SPLIT"
  | "MERGE"
  | "INSERT_COLON"
  | "RETYPE"
  | "REMOVE_META";

export interface UnstructuredOperation {
  op: UnstructuredOpType;
  at: number;
  detail: string;
}

export interface UnstructuredItem {
  i: number;
  type: UnstructuredItemType;
  raw: string;
  normalized: string;
  confidence: number;
  evidence: string[];
}

export interface UnstructuredResult {
  version: "unstructured-v1";
  operations: UnstructuredOperation[];
  items: UnstructuredItem[];
}

export interface UnstructuredDetectResult {
  applied: boolean;
  qualityScore: number;
  reasons: string[];
}

export interface UnstructuredReconstructionResult {
  applied: boolean;
  qualityScore: number;
  structuredText: string;
  structuredBlocks: ScreenplayBlock[];
  debug?: {
    reasons: string[];
    operationsCount: number;
    itemsCount: number;
  };
}
