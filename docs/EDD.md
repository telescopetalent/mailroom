# Mailroom — Engineering Design Document

## 1. Architecture Overview

Mailroom follows a **thin-client, fat-pipeline** architecture. All intelligence and business logic lives in the backend. Clients are input/output shells that send raw content and display structured results.

```
┌─────────────────────────────────────────────────────┐
│                   Capture Surfaces                   │
│  Web App │ Email │ Slack │ iOS │ Chrome │ Desktop    │
└─────────┬───────┬───────┬─────┬────────┬────────────┘
          │       │       │     │        │
          ▼       ▼       ▼     ▼        ▼
┌─────────────────────────────────────────────────────┐
│                    API Gateway                       │
│              (FastAPI + Auth Layer)                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 Capture Pipeline                     │
│  Ingest → Classify → Normalize → Extract → Review   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Data Layer                         │
│           PostgreSQL + S3 (attachments)              │
└─────────────────────────────────────────────────────┘
```

## 2. Backend Architecture

### 2.1 API Layer (FastAPI)

```
backend/app/
├── main.py                  # FastAPI app factory
├── api/
│   ├── captures.py          # POST /captures, GET /captures, etc.
│   ├── reviews.py           # Review workflow endpoints
│   ├── tasks.py             # Approved task endpoints
│   ├── webhooks.py          # Inbound webhooks (email, Slack)
│   └── health.py            # Health check
├── core/
│   ├── config.py            # Settings from env vars
│   ├── auth.py              # Authentication / API keys
│   ├── middleware.py         # Request logging, error handling
│   └── dependencies.py      # FastAPI dependency injection
├── models/
│   ├── capture.py           # Canonical capture object
│   ├── extraction.py        # Structured output schema
│   ├── task.py              # Approved task model
│   ├── user.py              # User / workspace models
│   └── enums.py             # Shared enums (source, content_type, status)
├── pipeline/
│   ├── orchestrator.py      # Pipeline coordinator
│   ├── ingest.py            # Raw input ingestion
│   ├── classify.py          # Source + content type classification
│   ├── normalize.py         # Normalization to canonical format
│   ├── extract.py           # AI-powered structured extraction
│   └── ocr.py               # Image/PDF text extraction
├── connectors/
│   ├── base.py              # Base connector interface
│   ├── web.py               # Web app connector
│   ├── email.py             # Email connector (inbound parsing)
│   ├── slack.py             # Slack connector (events API)
│   └── chrome.py            # Chrome extension connector
├── services/
│   ├── model_provider.py    # LLM abstraction (Anthropic / Gemini)
│   ├── storage.py           # S3 file storage
│   └── workspace.py         # Workspace/tenant management
└── tests/
```

### 2.2 Capture Pipeline

The pipeline is the core of Mailroom. Every surface funnels into the same pipeline stages:

```
Stage 1: INGEST
  Input:  Raw request from any surface
  Output: IngestResult(raw_content, source, user_id, workspace_id, attachments)

Stage 2: CLASSIFY
  Input:  IngestResult
  Output: ClassifyResult(content_type, source_metadata)

Stage 3: NORMALIZE
  Input:  IngestResult + ClassifyResult
  Output: Capture (canonical capture object)
  Note:   Extracts text from PDFs (PyPDF2) and DOCX (python-docx).
          Flags images in raw_content["image_keys"] for vision.

Stage 4: EXTRACT
  Input:  Capture (text + optional images)
  Output: Extraction (summary, tasks, owners, due_dates, etc.)
  Note:   For images, loads from storage, base64-encodes, sends to
          Claude Vision as multimodal content blocks.

Stage 5: REVIEW (user-facing)
  Input:  Capture + Extraction
  Output: ReviewDecision (approved/rejected items)
```

Each stage is an independent, testable function. The orchestrator coordinates them sequentially.

### 2.3 Connector Interface

Every capture surface implements a connector that translates surface-specific input into a common `IngestRequest`:

```python
class BaseConnector:
    """Translates surface-specific input into IngestRequest."""

    def parse_request(self, raw_input: Any) -> IngestRequest:
        """Parse surface-specific input into common format."""
        ...

    def format_response(self, extraction: Extraction) -> Any:
        """Format extraction result for surface-specific response."""
        ...
```

This keeps surface-specific logic isolated and makes adding new surfaces straightforward.

### 2.4 Model Provider Abstraction

```python
class ModelProvider:
    """Abstract interface for LLM calls."""

    def extract(self, text: str, image_data: list[dict] | None = None) -> dict:
        """Run structured extraction on text and/or images.

        image_data: optional list of {"data": base64_str, "media_type": "image/png"}
        For images, Claude Vision analyzes screenshots of emails, Slack threads,
        tweets, documents, etc. and extracts tasks/actions.
        """
        ...
```

Implementations: `AnthropicProvider`, `GeminiProvider`. The provider is selected via config. This allows switching or A/B testing models without changing pipeline code.

## 3. Data Models

### 3.1 Core Tables

```
users
  id              UUID PK
  email           TEXT UNIQUE
  name            TEXT
  created_at      TIMESTAMP

workspaces
  id                    UUID PK
  name                  TEXT
  trash_retention_days  INTEGER (default 30)
  created_at            TIMESTAMP

workspace_members
  workspace_id    UUID FK → workspaces
  user_id         UUID FK → users
  role            TEXT

surface_connections
  id              UUID PK
  workspace_id    UUID FK → workspaces
  user_id         UUID FK → users
  surface         TEXT ("email" | "slack")
  external_id     TEXT (email address or Slack team_id)
  config          JSONB
  is_active       BOOLEAN (default true)
  created_at      TIMESTAMP
  UNIQUE(surface, external_id)

captures
  id              UUID PK
  workspace_id    UUID FK → workspaces
  user_id         UUID FK → users
  source          TEXT (enum: web, email, slack, ios, chrome, desktop)
  source_ref      JSONB
  content_type    TEXT (enum: text, image, pdf, screenshot, url, mixed)
  raw_content     JSONB
  normalized_text TEXT
  status          TEXT (enum: pending, processing, review, approved, rejected, trashed)
  previous_status TEXT (nullable — stores status before trashing for restore)
  captured_at     TIMESTAMP
  trashed_at      TIMESTAMP (nullable)
  created_at      TIMESTAMP

extractions
  id              UUID PK
  capture_id      UUID FK → captures
  summary         TEXT
  next_steps      JSONB
  tasks           JSONB
  owners          JSONB
  due_dates       JSONB
  blockers        JSONB
  follow_ups      JSONB
  priority        TEXT (enum: high, medium, low, none)
  source_refs     JSONB
  model_provider  TEXT
  model_id        TEXT
  created_at      TIMESTAMP

approved_tasks
  id              UUID PK
  extraction_id   UUID FK → extractions
  capture_id      UUID FK → captures
  workspace_id    UUID FK → workspaces
  title           TEXT
  description     TEXT
  owner           TEXT
  due_date        DATE
  priority        TEXT
  source_ref      JSONB
  status          TEXT (enum: open, completed)
  approved_at     TIMESTAMP
  created_at      TIMESTAMP

attachments
  id              UUID PK
  capture_id      UUID FK → captures
  filename        TEXT
  content_type    TEXT
  s3_key          TEXT
  size_bytes      INTEGER
  created_at      TIMESTAMP
```

### 3.2 Source Reference Schema

Source references preserve traceability:

```json
{
  "source": "email",
  "email_message_id": "<abc123@example.com>",
  "email_from": "sender@example.com",
  "email_subject": "Q3 planning notes",
  "received_at": "2026-03-25T10:30:00Z"
}
```

```json
{
  "source": "slack",
  "channel_id": "C01234",
  "channel_name": "#project-alpha",
  "message_ts": "1711363800.000100",
  "thread_ts": "1711363700.000050",
  "permalink": "https://workspace.slack.com/archives/..."
}
```

## 4. API Design

### 4.1 Core Endpoints

```
POST   /api/v1/captures              Create a text capture (JSON body)
POST   /api/v1/captures/upload       Create a capture with files (multipart/form-data)
GET    /api/v1/captures              List captures for workspace (excludes trashed)
GET    /api/v1/captures/{id}         Get capture with extraction
PATCH  /api/v1/captures/{id}/review  Submit review decisions
POST   /api/v1/captures/{id}/trash   Move capture to trash
POST   /api/v1/captures/{id}/restore Restore capture from trash
POST   /api/v1/captures/{id}/reopen  Push approved/rejected back to review
DELETE /api/v1/captures/{id}         Permanently delete a trashed capture
GET    /api/v1/captures/trash        List trashed captures
POST   /api/v1/captures/trash/delete-all  Empty trash (permanently delete all)

POST   /api/v1/webhooks/email        Inbound email webhook (unauthenticated, lookup-based)
POST   /api/v1/webhooks/slack        Slack webhook (URL verification + slash commands)

GET    /api/v1/tasks                 List approved tasks (filterable by ?status=open|completed)
GET    /api/v1/tasks/{id}            Get task with source traceability
PATCH  /api/v1/tasks/{id}            Update task status

GET    /api/v1/surface-connections          List surface connections for workspace
POST   /api/v1/surface-connections          Register email or Slack connection
PATCH  /api/v1/surface-connections/{id}     Toggle active, update config
DELETE /api/v1/surface-connections/{id}     Remove connection

GET    /api/v1/workspaces/current           Get current workspace
PATCH  /api/v1/workspaces/current/settings  Update workspace settings (trash retention)

GET    /api/v1/health                Health check
```

### 4.2 Authentication

- API key per workspace for programmatic access
- JWT tokens for web app sessions
- Webhook verification for email and Slack
- All connectors authenticate before hitting the pipeline

## 5. Frontend Architecture

### 5.1 Web App (React + TypeScript)

The web app is one capture surface plus the primary review interface:

```
frontend/src/
├── App.tsx
├── api/                    # API client
├── components/
│   ├── capture/            # Capture input (paste, upload)
│   ├── review/             # Review workflow UI
│   ├── tasks/              # Approved tasks list
│   └── common/             # Shared UI components
├── hooks/                  # React hooks
├── pages/
│   ├── Dashboard.tsx       # Capture + review feed
│   ├── CaptureDetail.tsx   # Single capture + extraction
│   └── Tasks.tsx           # Approved tasks
├── types/                  # TypeScript types (mirror backend models)
└── utils/
```

### 5.2 Client Surfaces (Future)

All thin clients follow the same pattern:
1. Authenticate with API key or JWT
2. Send raw content to `POST /api/v1/captures`
3. Optionally display extraction result inline

## 6. Infrastructure (AWS)

### MVP
- **Compute:** ECS Fargate or Lambda (FastAPI)
- **Database:** RDS PostgreSQL
- **Storage:** S3 (attachments, raw files)
- **Email:** SES (inbound email receiving)
- **Queue:** SQS (async pipeline processing)

### Future
- CloudFront (CDN for frontend)
- ElastiCache (caching)
- API Gateway (rate limiting, API key management)

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Yes | Shared types, single CI, easier early iteration |
| Sync pipeline first | Yes | Simpler to build, async can be added later for heavy workloads |
| PostgreSQL | JSONB for flexible fields | Source refs and extraction outputs vary by type |
| Model abstraction | Provider interface | Swap/test models without pipeline changes |
| No ORM initially | Raw SQL or SQLAlchemy Core | Avoid ORM complexity early; upgrade later if needed |
| Webhook-based connectors | Pull not push | Email and Slack push to us; we don't poll |

## 8. Quality and Reliability (Phase 6)

### Testing

| Suite | Framework | Tests | Scope |
|-------|-----------|-------|-------|
| Backend | pytest + SQLite | 46 | Pipeline stages, API endpoints, webhooks, model provider |
| Frontend | Vitest + @testing-library/react | 7 | CaptureInput, Tasks page |

Test infrastructure uses an in-memory SQLite database with type adapters for PostgreSQL UUID/JSONB columns, avoiding external dependencies.

### Error Handling

Custom exception hierarchy (`app/core/exceptions.py`):
- `MailroomError` (base) → `NotFoundError`, `ValidationError`, `ExtractionError`, `ExternalServiceError`, `RateLimitError`
- Global exception handler returns structured JSON: `{"error": "error_code", "message": "..."}`
- Anthropic API calls have 60-second timeout

### Retry Logic

AI extraction calls use `tenacity` for automatic retry:
- 3 attempts with exponential backoff (2s → 30s)
- Retries on `TimeoutError` and `ConnectionError`
- Non-retryable errors (auth, invalid request) propagate immediately

### Rate Limiting

In-memory sliding-window rate limiter (`app/core/rate_limit.py`):
- Default: 60 requests/minute per user (configurable via `RATE_LIMIT_PER_MINUTE`)
- Checked in the `get_current_user` auth dependency
- Returns 429 when exceeded
- Note: In-memory only — Redis needed for horizontal scaling

### Input Validation

- `content_text` limited to 100,000 characters
- Uploaded filenames sanitized to prevent path traversal
- File uploads limited to 10MB per file, 5 files max
- Webhook signature verification ready (skipped when secrets not configured)

### Observability

- Request correlation IDs via `contextvars` (available in `request_id_var`)
- Middleware logs request ID, method, path, status, and duration for every request
- Pipeline orchestrator logs per-stage timing and total pipeline duration

## 9. Security Considerations

- All API endpoints require authentication (API key via Bearer token)
- Webhook endpoints are unauthenticated but verify sender via surface_connections lookup
- Rate limiting prevents API abuse (429 response)
- File uploads: size limits, content type whitelist, filename sanitization
- Custom exceptions prevent leaking internal error details
- No PII in logs
- S3 bucket not publicly accessible
- Environment variables for all secrets
