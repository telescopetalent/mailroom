# Mailroom

A low-friction, multi-surface capture and routing platform.

Mailroom meets users on the digital surface they're already using — email, Slack, iPhone, browser, screenshots, PDFs, copied text — and routes everything through a shared pipeline that normalizes input, extracts structured actions, and presents a review-first workflow.

## Core Idea

**Users should not have to go into the app to use the app.**

Mailroom is a routing layer first and an AI action engine second. The web app is one surface, not the product.

## How It Works

1. **Capture** — Send content from any surface (paste, email, Slack, share extension, browser extension, drag-and-drop)
2. **Route** — Identify user/workspace, classify source and content type
3. **Normalize** — Convert input into a canonical capture object with source traceability
4. **Extract** — AI extracts structured outputs: summary, tasks, owners, due dates, blockers, follow-ups, priority
5. **Review** — User reviews and approves extracted actions before they're saved
6. **Act** — Approved outputs saved as tasks with full source traceability

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Backend | Python (FastAPI) |
| Cloud | AWS |
| AI Models | Anthropic / Gemini (abstracted) |

## Project Structure

```
mailroom/
├── backend/        # Python API and pipeline
├── frontend/       # React web app
├── clients/        # Thin client surfaces (Chrome extension, iOS, desktop)
├── infra/          # AWS infrastructure
├── docs/           # PRD, EDD, implementation plan
└── scripts/        # Dev tooling
```

## Getting Started

> Project is in the planning phase. See `docs/` for product requirements, engineering design, and implementation plan.

## Documentation

- [Product Requirements](docs/PRD.md)
- [Engineering Design](docs/EDD.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

## License

Proprietary. All rights reserved.
