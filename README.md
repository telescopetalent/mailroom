# Mailroom

A low-friction, multi-surface capture and routing platform.

Mailroom meets users on the digital surface they're already using — email, Slack, web app, and more — and routes everything through a shared pipeline that normalizes input, extracts structured actions via AI, and presents a review-first workflow.

**Core principle:** Users should not have to go into the app to use the app.

Mailroom is a routing layer first and an AI action engine second.

---

## Current Status

**Phases 1–6 complete.** The platform has a working backend, frontend, AI extraction pipeline, connectors for email and Slack (stubbed for local testing), and a full test suite with production hardening.

| Phase | Status |
|-------|--------|
| 1. Product framing and planning | Done |
| 2. System design | Done |
| 3. Core platform foundation | Done |
| 4. Core engine MVP | Done |
| 5. Email and Slack connectors | Done |
| 6. Quality, trust, reliability | Done |
| 7. Native surfaces (iOS, Chrome extension) | Next |
| 8. Ambient capture (desktop drag-and-drop) | Planned |
| 9. Messaging expansion (SMS, Telegram, etc.) | Future |

---

## What Works Today

### Web App (localhost)
- **Text capture** — paste text, AI extracts tasks/actions
- **Image/screenshot capture** — drag or paste a screenshot (email, Slack thread, tweet, document), Claude Vision reads it and extracts actions
- **Document capture** — drag a PDF or DOCX, text is extracted server-side then analyzed by AI
- **Manual capture** — structured form for entering tasks, workflows, next steps, blockers, follow-ups
- **AI/Manual toggle** — switch between AI extraction and manual entry
- **Workflows** — AI groups sequential tasks into named workflows. Dependent follow-up tasks become the last step (e.g. "update org chart once hiring is complete" becomes step 6). AI infers missing intermediate steps. Approve workflows as a single unit.
- **Sequential step locking** — workflow steps unlock one at a time as prior steps are completed. Dependent steps show a visual divider "unlocks after above."
- **Drag-and-drop reordering** — reorder workflow steps on both the Tasks page and during review
- **Task detail modal** — Todoist-style slide-up modal with editable title, description, owner, due date, priority, labels, reminder, location, notes. Auto-saves on field change.
- **Task dependencies** — tasks can be blocked by a workflow or another task. Blocked tasks show a lock icon and can't be completed until the dependency is done.
- **Sub-tasks** — AI generates granular checklist items within each workflow step (e.g. "Clean bathroom" → scrub toilet, wipe counters, scrub shower, wipe mirrors). Checking off all sub-tasks auto-completes the parent step.
- **Manual workflow builder** — lock/block toggle per step to create sequential dependencies manually
- Review and approve/reject extracted items inline from the dashboard
- Todoist-style capture cards and task rendering with priority-colored circles
- Tasks page with workflow groups (progress bars, step checkboxes) and standalone tasks
- Workflow auto-completion when all steps are done, auto-reopen on uncomplete
- Trash system with configurable retention
- Settings page for trash retention and connected surfaces

### Email Capture (webhook, stubbed)
- Register sender email addresses as surface connections
- POST JSON to the email webhook to simulate inbound email
- Email content flows through the full AI extraction pipeline
- Source metadata (sender, subject, message_id) preserved

### Slack Capture (webhook, stubbed)
- Register Slack team IDs as surface connections
- Slash command `/mailroom <text>` triggers capture
- URL verification challenge handling for Slack app setup
- Source metadata (channel, team) preserved

---

## Getting Started

### Prerequisites
- Python 3.9+
- PostgreSQL running locally
- Node.js 18+

### 1. Clone and install

```bash
git clone https://github.com/telescopetalent/mailroom.git
cd mailroom

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Set up the database

```bash
createdb mailroom_dev

cd backend
python3 -m alembic upgrade head
```

### 3. Configure environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://localhost:5432/mailroom_dev
ANTHROPIC_API_KEY=sk-ant-...   # Optional — stub provider works without this
```

### 4. Start the servers

Terminal 1 — Backend:
```bash
cd backend
python3 -m uvicorn app.main:app --reload
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

### 5. Bootstrap your user

```bash
curl -X POST http://localhost:8000/api/v1/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Your Name","workspace_name":"My Workspace"}'
```

Save the `mr_...` API key from the response.

### 6. Use the web app

Open `http://localhost:5173`, paste your API key, and start capturing.

---

## Connecting External Surfaces

### Email (AWS SES — not yet wired)

**What's built:** The webhook endpoint, email connector, email parsing, and surface connection lookup are fully implemented. The endpoint accepts inbound email JSON and runs it through the AI pipeline.

**What's needed to go live:**

1. **AWS account** — Create an AWS account
2. **Domain** — Register or verify a domain in AWS SES (e.g., `inbound.mailroom.dev`)
3. **SES inbound rule** — Configure SES to receive email and forward to an SNS topic
4. **SNS subscription** — Point the SNS topic at `https://your-domain.com/api/v1/webhooks/email`
5. **Deploy backend** — The backend must be publicly accessible (not localhost)
6. **SNS message format** — Update the email webhook to parse the SNS envelope (currently accepts a simple JSON stub)
7. **Register sender** — In Settings > Connected Surfaces, add the email address that will forward to Mailroom

**Test locally now:**
```bash
# Register a sender
curl -X POST http://localhost:8000/api/v1/surface-connections \
  -H "Authorization: Bearer mr_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"surface":"email","external_id":"sender@example.com"}'

# Simulate inbound email
curl -X POST http://localhost:8000/api/v1/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{"from":"sender@example.com","subject":"Meeting notes","body_text":"Ship v2 by Friday. John owns the deploy.","message_id":"<msg@example.com>"}'
```

### Slack (Slash Command — not yet wired)

**What's built:** The webhook endpoint, Slack connector, slash command parsing, URL verification, and surface connection lookup are fully implemented.

**What's needed to go live:**

1. **Slack app** — Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. **Slash command** — Add a slash command `/mailroom` pointing to `https://your-domain.com/api/v1/webhooks/slack`
3. **Signing secret** — Copy the Slack app's signing secret into `backend/.env` as `SLACK_SIGNING_SECRET`
4. **Deploy backend** — Must be publicly accessible for Slack to reach
5. **Install app** — Install the Slack app to your workspace
6. **Register team** — In Settings > Connected Surfaces, add the Slack team ID (found in Slack workspace settings)

**Test locally now:**
```bash
# Register a Slack workspace
curl -X POST http://localhost:8000/api/v1/surface-connections \
  -H "Authorization: Bearer mr_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"surface":"slack","external_id":"T01ABCDEF"}'

# Test URL verification (Slack sends this during app setup)
curl -X POST http://localhost:8000/api/v1/webhooks/slack \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test123"}'

# Simulate slash command
curl -X POST http://localhost:8000/api/v1/webhooks/slack \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "team_id=T01ABCDEF&channel_id=C01&channel_name=general&user_id=U01&text=Review budget by Thursday&command=/mailroom"
```

### Anthropic API (AI Extraction)

**What's built:** Full model provider abstraction with Anthropic Claude integration, including Vision support for image/screenshot analysis. A stub provider works without an API key.

**What's needed:**

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add to `backend/.env`: `ANTHROPIC_API_KEY=sk-ant-...`
4. Restart the backend

Without an API key, captures use the stub provider (returns a placeholder summary, no extracted tasks). Vision (image analysis) requires the API key.

---

## What's Built for Quality (Phase 6)

- **53 backend tests** — pipeline, captures, reviews, tasks, workflows, webhooks, model provider (pytest + SQLite)
- **8 frontend tests** — CaptureInput, Tasks page (Vitest + @testing-library/react)
- **Custom exceptions** — MailroomError hierarchy with structured JSON error responses
- **Retry logic** — Anthropic API calls retry 3x with exponential backoff (2-30s) via tenacity
- **Rate limiting** — 120 requests/min per user, in-memory sliding window
- **Input validation** — Content length limits (100K chars), filename sanitization (path traversal prevention)
- **Correlation IDs** — Request ID in middleware logs and available via contextvars
- **Pipeline timing** — Per-stage and total duration logged
- **N+1 query optimization** — Batch-loaded extractions and attachment counts on list endpoints
- **7 Alembic migrations** — Full schema versioning

### Running Tests

```bash
# Backend
cd backend && python3 -m pytest tests/ -v

# Frontend
cd frontend && npm test
```

---

## What Remains to Build

### Infrastructure (Prerequisite for All Future Phases)
Before any native surface can go live, the backend needs to be publicly deployed:
1. **AWS account** — Create account, set up IAM
2. **Deploy backend** — ECS Fargate or Lambda with FastAPI
3. **Production database** — RDS PostgreSQL
4. **File storage** — S3 bucket for attachments (swap `STORAGE_BACKEND=s3`)
5. **Domain + SSL** — Register domain, CloudFront CDN for frontend
6. **CI/CD** — GitHub Actions for automated tests + deploy
7. **Wire email** — SES inbound → SNS → webhook endpoint
8. **Wire Slack** — Slack app with signing secret → slash command endpoint
9. **Environment management** — Staging vs production configs

### Phase 7 — Native Surfaces (Next)
Recommended build order (each builds on the API already in place):

1. **Chrome extension** (fastest to build — uses existing web API)
   - Popup capture form (paste text, screenshot current page)
   - Right-click context menu: "Send to Mailroom"
   - Selected text capture
   - Badge showing pending review count
   - Thin client → POST /api/v1/captures

2. **iPhone app** (SwiftUI)
   - Capture-first interface: paste, type, camera, voice
   - Review workflow with approve/reject
   - Task list with workflow groups
   - Push notifications for new captures

3. **iOS share extension**
   - Share from any app (Safari, Notes, Mail) → POST /api/v1/captures
   - Minimal UI: shows capture confirmation

4. **Apple Notes share flow**
   - Share note content directly to Mailroom

### Phase 8 — Ambient Capture
- **Desktop app** — Menubar/dock drag-and-drop bin (Electron or Tauri)
- Clipboard monitoring (opt-in)
- Screenshot capture hotkey
- File drop zone

### Phase 9 — Messaging Expansion (Future)
- SMS, Telegram, Discord, WhatsApp connectors
- Each follows the same connector pattern as email/Slack
- Webhook-based: each platform pushes to a Mailroom endpoint

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript (Vite) |
| Backend | Python 3.9+ (FastAPI) |
| Database | PostgreSQL + Alembic migrations |
| AI Models | Anthropic Claude (abstracted — Gemini ready) |
| Cloud | AWS (planned) |

## API Documentation

With the backend running, visit `http://localhost:8000/docs` for interactive API docs (Swagger UI).

## Project Documentation

- [Product Requirements](docs/PRD.md)
- [Engineering Design](docs/EDD.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

## License

Proprietary. All rights reserved.
