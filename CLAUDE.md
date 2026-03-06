# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Avan Titre (أفان تيتر)** — Arabic professional screenplay editor for web. Built with React 19 + Tiptap 3 (ProseMirror) frontend and Express 5 backend. The core feature is a 4-layer classification pipeline that auto-classifies pasted/imported Arabic screenplay text into 8 element types (action, dialogue, character, sceneHeaderTopLine, sceneHeader1/2/3, transition, parenthetical, basmala).

## Commands

```bash
# Development
pnpm dev              # Concurrent: Vite dev server + backend file-import server
pnpm dev:app          # Frontend only (Vite)
pnpm file-import:server  # Backend only (Express on 127.0.0.1:8787)

# Build & Validate
pnpm build            # TypeScript + Vite bundle → ./dist
pnpm typecheck        # tsc type checking (noEmit)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm validate         # All checks: format + lint + typecheck + test

# Testing
pnpm test             # Unit + integration tests with coverage (Vitest)
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests (vitest.pipeline.config.ts)
pnpm test:e2e         # Playwright E2E tests (requires dev server running)
pnpm test:e2e:audit   # Comprehensive UI audit

# Run a single test file
npx vitest run tests/unit/some-test.test.ts
npx vitest run tests/integration/some-test.test.ts

# OCR & RAG
pnpm ocr:start        # Single file OCR agent
pnpm rag:index        # Index documents in Qdrant
pnpm rag:query        # Query the vector database
```

## Architecture

### Hybrid Pattern (React + Imperative Classes + DOM Factory)

The app uses three distinct patterns together:
- **React components** (`App.tsx`, app-shell/) for top-level UI state and layout
- **Imperative classes** (`EditorArea.ts`) for Tiptap editor lifecycle — ProseMirror state is managed outside React
- **DOM factory pattern** for `src/components/ui/` (53 Radix UI components, no JSX)

### 4-Layer Classification Pipeline

Text classification flows through these layers in order:

1. **Regex patterns** (`arabic-patterns.ts`) — deterministic Arabic-specific regex
2. **Context rules** (`context-memory-manager.ts`) — tracks characters, locations, dialogue blocks across the session
3. **Hybrid classifier** (`hybrid-classifier.ts`) — scoring + confidence with sequence optimization (`structural-sequence-optimizer.ts`)
4. **AI agent fallback** — suspicious lines sent to backend `/api/agent/review` → Claude Haiku

Post-classification passes:
- `classification-core.ts` — 8 quality detectors that flag suspicious lines
- `retroactive-corrector.ts` — fixes broken character names
- `ai-progressive-updater.ts` — streams real-time corrections from Gemini/Kimi/Claude

### Frontend → Backend Communication

| Endpoint | Purpose | AI Provider |
|----------|---------|-------------|
| `POST /api/file-extract` | Extract text from PDF/DOC/DOCX/TXT/Fountain/FDX | Mistral (OCR) |
| `POST /api/agent/review` | Classify suspicious lines | Anthropic Claude |
| `POST /api/ai/context-enhance` | Context-aware correction (SSE streaming) | Google Gemini |
| `POST /api/ai/doubt-resolve` | Resolve ambiguous classifications (SSE streaming) | Kimi/Moonshot |
| `POST /api/export/pdfa` | HTML → PDF via Puppeteer | — |

### Key Source Directories

- `src/extensions/` — 27 Tiptap extensions + classification engine. `paste-classifier.ts` (2584 lines) is the main classification entry point
- `src/pipeline/` — Import orchestration, agent command engine, packet budget
- `src/components/app-shell/` — AppHeader, AppSidebar, AppDock, AppFooter
- `src/rag/` — Qdrant vector DB + Gemini embeddings for document indexing
- `src/ocr-arabic-pdf-to-txt-pipeline/` — Separate OCR subsystem with its own MCP server
- `server/` — Express backend (`.mjs` files): file extraction, AI agent review, OCR runner, vision proofread

### Editor Configuration

- **Tiptap 3** on **ProseMirror** with `@tiptap-pro/extension-pages` for A4 pagination
- Page dimensions: 794×1123px @ 96 PPI
- 8 screenplay element types registered as custom Tiptap block nodes
- Keyboard shortcuts: Ctrl+0 through Ctrl+7 for element type switching
- `src/editor.ts` — `createScreenplayEditor()` factory, `SCREENPLAY_ELEMENTS` registry

### Type System

- `ElementType` (camelCase): `action`, `dialogue`, `character`, `sceneHeaderTopLine`, `sceneHeader1`, `sceneHeader2`, `sceneHeader3`, `transition`, `parenthetical`, `basmala`
- `LegacyElementType` (kebab-case): used in some API boundaries — convert via `fromLegacyElementType()` / `toLegacyElementType()` in `classification-types.ts`
- `ClassifiedDraft` — the core unit of classified text (type, text, confidence, classificationMethod)

## Code Conventions

- **File naming:** kebab-case for all files (e.g., `context-memory-manager.ts`)
- **Classes:** PascalCase (e.g., `PostClassificationReviewer`)
- **Constants:** SCREAMING_SNAKE_CASE (e.g., `SCREENPLAY_ELEMENTS`)
- **Server files:** `.mjs` extension (ES modules for Node.js)
- **Styling:** Tailwind CSS with OKLCH color system, RTL-first, dark-only theme
- **Package manager:** pnpm (v10.28) — do not use npm or yarn
- **Language:** Arabic UI and interface, RTL layout throughout. Code comments may be in Arabic.

## Environment Setup

Copy `.env.example` to `.env`. Required API keys:
- `ANTHROPIC_API_KEY` — Claude agent review
- `MISTRAL_API_KEY` — PDF OCR
- `MOONSHOT_API_KEY` — Kimi doubt resolution + vision judge
- `GEMINI_API_KEY` — Context enhancement + vision proofread
- `ANTIWORD_PATH` / `ANTIWORDHOME` — DOC/DOCX extraction (Windows: `C:/antiword/antiword.exe`)

Backend runs on `127.0.0.1:8787` by default. Frontend VITE_ prefixed env vars connect to backend endpoints.

## Testing

- **Unit/Integration:** Vitest 4.0 with jsdom environment. Config: `vitest.config.ts` (unit), `vitest.pipeline.config.ts` (integration)
- **E2E:** Playwright with Chromium. Base URL: `localhost:5174`. Screenshots on failure saved to `test-results/`
- **Coverage:** v8 provider, output in `test-results/coverage/`
- Test fixtures in `tests/fixtures/`, helpers in `tests/helpers/`, harness in `tests/harness/`

## Current Branch Context

Branch `مرحلة-2` (Phase 2) focuses on: RAG system integration, AI context/doubt layers, classification pipeline hardening.
