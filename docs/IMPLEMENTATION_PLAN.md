# Mailroom — Implementation Plan

## Phase Overview

| # | Phase | Goal | Status |
|---|-------|------|--------|
| 1 | Product framing and planning | Define product, docs, repo structure | Current |
| 2 | System design | Architecture, data models, API contracts | Next |
| 3 | Core platform foundation | Backend skeleton, DB, auth, basic frontend | Planned |
| 4 | Core engine MVP | Capture pipeline + extraction + review workflow | Planned |
| 5 | Core external surfaces | Email and Slack connectors | Planned |
| 6 | Quality, trust, reliability | Testing, monitoring, error handling, edge cases | Planned |
| 7 | Native surfaces | iPhone app, iOS share extension, Apple Notes, Chrome extension | Planned |
| 8 | Ambient capture | Desktop drag-and-drop bin | Planned |
| 9 | Messaging expansion | SMS, Telegram, Discord, WhatsApp | Future |

---

## Phase 1 — Product Framing and Planning

### Milestone: Source-of-truth documentation complete

**Epic 1.1: Repository and documentation setup**
- [x] Initialize git repo
- [ ] Create CLAUDE.md with project instructions
- [ ] Create README.md
- [ ] Create docs/PRD.md
- [ ] Create docs/EDD.md
- [ ] Create docs/IMPLEMENTATION_PLAN.md
- [ ] Create monorepo folder structure

**Deliverable:** All stakeholders aligned on product definition, architecture, and build sequence.

---

## Phase 2 — System Design

### Milestone: API contracts and data models finalized

**Epic 2.1: Data model definition**
- [ ] Define Pydantic models for Capture, Extraction, Task
- [ ] Define enum types (Source, ContentType, Status, Priority)
- [ ] Define source reference schemas per surface
- [ ] Define API request/response schemas

**Epic 2.2: API contract specification**
- [ ] Define capture CRUD endpoints
- [ ] Define review workflow endpoints
- [ ] Define webhook endpoint contracts (email, Slack)
- [ ] Define task endpoints
- [ ] Document auth strategy (API keys + JWT)

**Deliverable:** Typed contracts that frontend and all connectors build against.

---

## Phase 3 — Core Platform Foundation

### Milestone: Running backend + frontend with auth and DB

**Epic 3.1: Backend skeleton**
- [ ] FastAPI app factory with config
- [ ] Health check endpoint
- [ ] Request logging middleware
- [ ] Error handling middleware
- [ ] CORS configuration

**Epic 3.2: Database setup**
- [ ] PostgreSQL schema (users, workspaces, captures, extractions, tasks, attachments)
- [ ] Database connection and session management
- [ ] Migration tooling (Alembic)
- [ ] Seed data for development

**Epic 3.3: Authentication**
- [ ] API key generation and validation
- [ ] JWT token issuance and validation
- [ ] Auth middleware / dependency injection
- [ ] User and workspace CRUD

**Epic 3.4: File storage**
- [ ] S3 integration for attachment upload/download
- [ ] Local file storage adapter for development
- [ ] Content type validation and size limits

**Epic 3.5: Frontend skeleton**
- [ ] React + TypeScript project setup (Vite)
- [ ] Routing (React Router)
- [ ] API client module
- [ ] Auth flow (login, token management)
- [ ] Basic layout shell (nav, content area)

**Deliverable:** Deployable backend with DB, auth, file storage. Frontend shell with auth flow.

---

## Phase 4 — Core Engine MVP

### Milestone: End-to-end capture → extract → review → approve via web app

**Epic 4.1: Capture pipeline — Ingest**
- [ ] IngestRequest model
- [ ] Web connector: parse paste/upload input
- [ ] Attachment handling (upload to S3, create attachment record)
- [ ] POST /api/v1/captures endpoint wired to pipeline

**Epic 4.2: Capture pipeline — Classify**
- [ ] Content type detection (text, image, PDF, URL, mixed)
- [ ] Source metadata extraction
- [ ] Classification stage function

**Epic 4.3: Capture pipeline — Normalize**
- [ ] Text normalization
- [ ] OCR for images/screenshots (basic)
- [ ] PDF text extraction
- [ ] URL content fetching
- [ ] Create canonical Capture record in DB

**Epic 4.4: Capture pipeline — Extract**
- [ ] Model provider abstraction (interface)
- [ ] Anthropic provider implementation
- [ ] Extraction prompt engineering
- [ ] Structured output parsing (summary, tasks, owners, etc.)
- [ ] Extraction record saved to DB

**Epic 4.5: Capture pipeline — Orchestrator**
- [ ] Pipeline orchestrator: ingest → classify → normalize → extract
- [ ] Error handling per stage
- [ ] Status tracking (pending → processing → review)

**Epic 4.6: Review workflow**
- [ ] GET /api/v1/captures with extraction data
- [ ] PATCH /api/v1/captures/{id}/review — approve/reject items
- [ ] Approved items → approved_tasks table
- [ ] Source traceability preserved on approved tasks

**Epic 4.7: Web app capture + review UI**
- [ ] Capture input component (text paste, file upload)
- [ ] Capture list/feed view
- [ ] Capture detail view with extraction results
- [ ] Review interface (approve/edit/reject per item)
- [ ] Approved tasks list view

**Deliverable:** A user can paste text or upload a file in the web app, see AI-extracted actions, review and approve them, and view saved tasks — all with source traceability.

---

## Phase 5 — Core External Surfaces: Email and Slack

### Milestone: Users can capture from email and Slack

**Epic 5.1: Email connector**
- [ ] Inbound email receiving (AWS SES or webhook-based provider)
- [ ] Email parsing (body, subject, attachments, sender)
- [ ] Email connector: parse into IngestRequest
- [ ] Webhook endpoint: POST /api/v1/webhooks/email
- [ ] Email-to-user routing (match sender to workspace)
- [ ] Reply-based review (optional: approve via email reply)

**Epic 5.2: Slack connector**
- [ ] Slack app creation (bot token, event subscriptions)
- [ ] Slack Events API webhook
- [ ] Message action / slash command to capture
- [ ] Slack connector: parse message into IngestRequest
- [ ] Webhook endpoint: POST /api/v1/webhooks/slack
- [ ] Slack thread-based review (optional: show extraction in thread)

**Deliverable:** Users can forward an email or use a Slack command to capture content into Mailroom.

---

## Phase 6 — Quality, Trust, and Reliability

### Milestone: Production-ready core system

**Epic 6.1: Testing**
- [ ] Unit tests for each pipeline stage
- [ ] Integration tests for full pipeline
- [ ] API endpoint tests
- [ ] Frontend component tests
- [ ] Connector-specific tests

**Epic 6.2: Error handling and resilience**
- [ ] Pipeline stage failure handling and retry
- [ ] Graceful degradation (if extraction fails, still save capture)
- [ ] Input validation hardening
- [ ] Rate limiting

**Epic 6.3: Observability**
- [ ] Structured logging
- [ ] Pipeline stage timing metrics
- [ ] Error tracking (Sentry or equivalent)
- [ ] Health check dashboard

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
