# Mailroom — Project Instructions

## What is Mailroom?

A low-friction, multi-surface capture and routing platform. Users send content from whatever digital surface they're already on — email, Slack, iPhone, browser, screenshots, PDFs — and Mailroom normalizes it, extracts structured actions, and presents a review-first workflow.

**Core principle:** Users should not have to go into the app to use the app.

**Product definition:** Routing layer first, AI action engine second.

## Tech Stack

- **Frontend:** React + TypeScript
- **Backend:** Python (FastAPI)
- **Cloud:** AWS
- **Model providers:** Anthropic and/or Gemini (abstracted)
- **Architecture:** Modular monorepo, thin clients, shared backend services

## Monorepo Structure

```
mailroom/
├── CLAUDE.md                  # This file — project instructions
├── README.md                  # Project overview
├── docs/                      # Source-of-truth documentation
│   ├── PRD.md                 # Product requirements
│   ├── EDD.md                 # Engineering design document
│   └── IMPLEMENTATION_PLAN.md # Phased build plan
├── backend/                   # Python backend
│   ├── app/                   # FastAPI application
│   │   ├── api/               # API routes
│   │   ├── core/              # Config, auth, middleware
│   │   ├── models/            # Data models / schemas
│   │   ├── pipeline/          # Capture pipeline stages
│   │   ├── connectors/        # Surface connectors (email, Slack, etc.)
│   │   └── services/          # Business logic
│   ├── tests/                 # Backend tests
│   └── requirements.txt
├── frontend/                  # React + TypeScript web app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── clients/                   # Thin client surfaces (future)
│   ├── chrome-extension/
│   ├── ios/
│   └── desktop/
├── infra/                     # AWS infrastructure-as-code
└── scripts/                   # Dev tooling and utilities
```

## Phase Order (strict)

1. Product framing and planning
2. System design
3. Core platform foundation
4. Core engine MVP
5. Core external surfaces: email and Slack
6. Quality, trust, and reliability
7. Low-friction native surfaces: iPhone app, iOS share extension, Apple Notes share flow, Chrome extension
8. Ambient capture: desktop drag-and-drop bin
9. Messaging expansion: SMS, Telegram, Discord, WhatsApp later

## Key Product Requirements

- Low friction and multi-surface from day one
- Architecture must support future surfaces even if not built in MVP
- Web app is one surface, not the product
- Review-first, not autonomous
- Do not drift into a generic to-do app
- The moat: capture routing + normalization + action extraction + source traceability
- Keep clients thin
- Centralize routing
- Preserve source traceability
- Avoid overengineering

## Capture Pipeline (all surfaces share this)

1. Identify user/workspace
2. Classify source and content type
3. Normalize into canonical capture object
4. Extract structured action
5. Present review-first workflow
6. Save approved outputs as tasks with source traceability

## Structured Output Fields

summary, next steps, tasks, owners, due dates, blockers, follow-ups, priority, source references

## Development Guidelines

- Run backend: `cd backend && uvicorn app.main:app --reload`
- Run frontend: `cd frontend && npm run dev`
- Run backend tests: `cd backend && pytest`
- Run frontend tests: `cd frontend && npm test`
- Lint backend: `cd backend && ruff check .`
- Lint frontend: `cd frontend && npm run lint`

## Conventions

- Backend API routes go in `backend/app/api/`
- Pipeline stages go in `backend/app/pipeline/`
- Each surface connector lives in `backend/app/connectors/{surface_name}.py`
- Frontend components in `frontend/src/components/`
- All API contracts defined as Pydantic models in `backend/app/models/`
- Use environment variables for secrets and config (never commit secrets)
