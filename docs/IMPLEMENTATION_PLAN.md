# Mailroom — Implementation Plan

## Phase Overview

| # | Phase | Goal | Status |
|---|-------|------|--------|
| 1 | Product framing and planning | Define product, docs, repo structure | Done |
| 2 | System design | Architecture, data models, API contracts | Done |
| 3 | Core platform foundation | Backend skeleton, DB, auth, basic frontend | Done |
| 4 | Core engine MVP | Capture pipeline + extraction + review workflow | Done |
| 5 | Core external surfaces | Email and Slack connectors | Done |
| 6 | Quality, trust, reliability | Testing, monitoring, error handling, edge cases | Done |
| 7 | Native surfaces | iPhone app, iOS share extension, Apple Notes, Chrome extension | Next |
| 8 | Ambient capture | Desktop drag-and-drop bin | Planned |
| 9 | Messaging expansion | SMS, Telegram, Discord, WhatsApp | Future |

---

## Phase 1 — Product Framing and Planning

### Milestone: Source-of-truth documentation complete

**Epic 1.1: Repository and documentation setup**
- [x] Initialize git repo
- [x] Create CLAUDE.md with project instructions
- [x] Create README.md
- [x] Create docs/PRD.md
- [x] Create docs/EDD.md
- [x] Create docs/IMPLEMENTATION_PLAN.md
- [x] Create monorepo folder structure

**Deliverable:** All stakeholders aligned on product definition, architecture, and build sequence.

---

## Phase 2 — System Design

### Milestone: API contracts and data models finalized

**Epic 2.1: Data model definition**
- [x] Define Pydantic models for Capture, Extraction, Task
- [x] Define enum types (Source, ContentType, Status, Priority)
- [x] Define source reference schemas per surface
- [x] Define API request/response schemas

**Epic 2.2: API contract specification**
- [x] Define capture CRUD endpoints
- [x] Define review workflow endpoints
- [x] Define webhook endpoint contracts (email, Slack)
- [x] Define task endpoints
- [x] Document auth strategy (API keys + JWT)

**Deliverable:** Typed contracts that frontend and all connectors build against.

---

## Phase 3 — Core Platform Foundation

### Milestone: Running backend + frontend with auth and DB

**Epic 3.1: Backend skeleton**
- [x] FastAPI app factory with config
- [x] Health check endpoint
- [x] Request logging middleware
- [x] Error handling middleware
- [x] CORS configuration

**Epic 3.2: Database setup**
- [x] PostgreSQL schema (users, workspaces, captures, extractions, tasks, attachments)
- [x] Database connection and session management
- [x] Migration tooling (Alembic)
- [ ] Seed data for development

**Epic 3.3: Authentication**
- [x] API key generation and validation
- [ ] JWT token issuance and validation (deferred — API keys only for MVP)
- [x] Auth middleware / dependency injection
- [x] User and workspace CRUD

**Epic 3.4: File storage**
- [x] S3 integration for attachment upload/download
- [x] Local file storage adapter for development
- [ ] Content type validation and size limits

**Epic 3.5: Frontend skeleton**
- [x] React + TypeScript project setup (Vite)
- [x] Routing (React Router)
- [x] API client module
- [x] Auth flow (API key entry)
- [x] Basic layout shell (nav, content area)

**Deliverable:** Deployable backend with DB, auth, file storage. Frontend shell with auth flow.

---

## Phase 4 — Core Engine MVP

### Milestone: End-to-end capture → extract → review → approve via web app

**Epic 4.1: Capture pipeline — Ingest**
- [x] IngestRequest model
- [x] Web connector: parse paste/upload input
- [x] Attachment handling (upload to S3, create attachment record)
- [x] POST /api/v1/captures endpoint wired to pipeline

**Epic 4.2: Capture pipeline — Classify**
- [x] Content type detection (text, image, PDF, URL, mixed)
- [x] Source metadata extraction
- [x] Classification stage function

**Epic 4.3: Capture pipeline — Normalize**
- [x] Text normalization
- [x] Image vision via Claude (screenshots of emails, Slack, tweets, docs)
- [x] PDF text extraction (PyPDF2)
- [x] DOCX text extraction (python-docx)
- [ ] URL content fetching (deferred to Phase 6)
- [x] Create canonical Capture record in DB

**Epic 4.4: Capture pipeline — Extract**
- [x] Model provider abstraction (interface)
- [x] Anthropic provider implementation (text + vision)
- [x] Extraction prompt engineering (text and vision prompts)
- [x] Structured output parsing (summary, tasks, owners, etc.)
- [x] Extraction record saved to DB
- [x] Multimodal extraction: images sent as base64 content blocks to Claude Vision

**Epic 4.5: Capture pipeline — Orchestrator**
- [x] Pipeline orchestrator: ingest → classify → normalize → extract
- [x] Error handling per stage
- [x] Status tracking (pending → processing → review)

**Epic 4.6: Review workflow**
- [x] GET /api/v1/captures with extraction data
- [x] PATCH /api/v1/captures/{id}/review — approve/reject items
- [x] Approved items → approved_tasks table
- [x] Source traceability preserved on approved tasks

**Epic 4.7: Web app capture + review UI**
- [x] Capture input component (text paste, file upload)
- [x] AI/Manual capture mode toggle
- [x] Drag-and-drop zone for images, PDFs, DOCX files
- [x] Clipboard paste support for images
- [x] File preview with thumbnails (images) and icons (PDF/DOCX)
- [x] POST /captures/upload endpoint for multipart file uploads
- [x] Capture list/feed view with trash buttons
- [x] Capture detail view with extraction results
- [x] Review interface (approve/edit/reject per item)
- [x] Tasks page with open/completed sections
- [x] Trash system with configurable retention
- [x] Settings page (trash retention, connected surfaces)

**Deliverable:** A user can paste text, drag images/documents, or use manual entry in the web app. AI extracts actions (including from screenshots via vision). Users review, approve, and manage tasks — all with source traceability.

---

## Phase 5 — Core External Surfaces: Email and Slack

### Milestone: Users can capture from email and Slack

**Epic 5.1: Email connector**
- [x] Inbound email receiving (webhook endpoint, AWS SES stubbed)
- [x] Email parsing (body, subject, sender, message_id)
- [x] Email connector: parse into pipeline kwargs
- [x] Webhook endpoint: POST /api/v1/webhooks/email
- [x] Email-to-user routing (surface_connections lookup)
- [ ] Reply-based review (deferred — approve via email reply)

**Epic 5.2: Slack connector**
- [x] Slack slash command support (/mailroom)
- [x] Slack URL verification challenge handling
- [x] Slack connector: parse slash command into pipeline kwargs
- [x] Webhook endpoint: POST /api/v1/webhooks/slack
- [ ] Slack thread-based review (deferred — show extraction in thread)

**Epic 5.3: Surface connections**
- [x] surface_connections table (maps external IDs to workspaces)
- [x] CRUD API for surface connections
- [x] Connected Surfaces UI in Settings page
- [x] Alembic migration 004

**Deliverable:** Users can forward an email or use a Slack command to capture content into Mailroom.

---

## Phase 6 — Quality, Trust, and Reliability

### Milestone: Production-ready core system

**Epic 6.1: Testing**
- [x] pytest test infrastructure with SQLite (conftest.py, fixtures, auth helpers)
- [x] Pipeline stage tests (ingest, classify, normalize, extract) — 10 tests
- [x] Capture API tests (CRUD, upload, trash/restore) — 12 tests
- [x] Review workflow tests (approve, reject, mixed, reopen) — 7 tests
- [x] Task API tests (list, filter, update, orphan survival) — 7 tests
- [x] Webhook tests (email, Slack, unregistered senders) — 7 tests
- [x] Model provider tests (stub, properties) — 3 tests
- [x] Frontend tests: Vitest + @testing-library/react — 7 tests (CaptureInput, Tasks)
- [x] TypeScript build passes clean

**Epic 6.2: Error handling and resilience**
- [x] Custom exception hierarchy (MailroomError → NotFoundError, ValidationError, ExtractionError, RateLimitError)
- [x] Global exception handler for structured JSON error responses
- [x] Anthropic API timeout (60s) and error wrapping
- [x] Retry logic with exponential backoff (3 attempts, 2-30s) via tenacity
- [x] Input validation: content_text max_length=100K, filename sanitization
- [x] Rate limiting: in-memory sliding-window (60 req/min per user, configurable)

**Epic 6.3: Observability**
- [x] Correlation IDs via contextvars (request_id in all log lines)
- [x] Pipeline stage timing (per-stage and total duration logged)
- [x] Loading states for Dashboard and Tasks pages
- [ ] Error tracking (Sentry or equivalent — deferred to deployment)
- [ ] Health check dashboard (deferred to deployment)

**Epic 6.4: Edge cases**
- [ ] Large file handling
- [ ] Malformed input handling
- [ ] Duplicate capture detection
- [ ] Empty/minimal content handling

**Deliverable:** System handles failures gracefully, has comprehensive tests, and is observable in production.

---

## Phase 7 — Low-Friction Native Surfaces

### Milestone: iPhone, iOS share extension, Apple Notes, Chrome extension

**Epic 7.1: iPhone app**
- [ ] SwiftUI capture-first app
- [ ] Camera, paste, voice note input
- [ ] API client (shared with share extension)
- [ ] Push notification for review results

**Epic 7.2: iOS share extension**
- [ ] Share extension target
- [ ] Handle text, URLs, images, files from any app
- [ ] Send to POST /api/v1/captures

**Epic 7.3: Apple Notes share flow**
- [ ] Share extension support for Notes app
- [ ] Parse shared note content

**Epic 7.4: Chrome extension**
- [ ] Extension popup for quick capture
- [ ] Right-click context menu (send selected text, page)
- [ ] Screenshot capture
- [ ] Bookmark capture
- [ ] Send to POST /api/v1/captures

**Deliverable:** Users can capture from iPhone, any iOS app, Notes, and Chrome without opening the web app.

---

## Phase 8 — Ambient Capture: Desktop Drag-and-Drop

### Milestone: Desktop menubar/dock bin

**Epic 8.1: Desktop app**
- [ ] Electron or Tauri app
- [ ] Menubar/dock presence
- [ ] Drag-and-drop file capture
- [ ] Clipboard monitoring (opt-in)
- [ ] Screenshot capture hotkey

**Deliverable:** Users can drag files or screenshots to a desktop bin for instant capture.

---

## Phase 9 — Messaging Expansion (Future)

### Milestone: SMS, Telegram, Discord, WhatsApp connectors

- Each follows the same connector pattern as email/Slack
- Connector parses surface-specific message → IngestRequest → pipeline
- Detailed planning deferred until Phase 8 is complete

---

## First Implementation Slice (Dependency Order)

This is the exact build sequence for going from zero to a working MVP (Phases 2-4):

```
Step 1:  Pydantic models + enums (models/)
         ↓
Step 2:  Config + settings (core/config.py)
         ↓
Step 3:  Database schema + connection (PostgreSQL + Alembic)
         ↓
Step 4:  FastAPI app factory + health endpoint
         ↓
Step 5:  Auth (API keys + JWT, middleware)
         ↓
Step 6:  File storage service (S3 + local adapter)
         ↓
Step 7:  Pipeline stage — Ingest
         ↓
Step 8:  Pipeline stage — Classify
         ↓
Step 9:  Pipeline stage — Normalize (text, OCR, PDF)
         ↓
Step 10: Model provider abstraction + Anthropic implementation
         ↓
Step 11: Pipeline stage — Extract
         ↓
Step 12: Pipeline orchestrator
         ↓
Step 13: Capture API endpoints (POST, GET)
         ↓
Step 14: Review API endpoints (PATCH review decisions)
         ↓
Step 15: Task API endpoints (GET approved tasks)
         ↓
Step 16: Frontend — project setup + auth flow
         ↓
Step 17: Frontend — capture input (paste + upload)
         ↓
Step 18: Frontend — capture list + detail view
         ↓
Step 19: Frontend — review interface
         ↓
Step 20: Frontend — approved tasks view
         ↓
Step 21: End-to-end integration testing
```

Each step produces a testable, deployable increment. No step depends on a future step.
