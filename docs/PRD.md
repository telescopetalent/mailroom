# Mailroom — Product Requirements Document

## 1. Vision

Mailroom is a low-friction, multi-surface capture and routing platform. It meets users on the digital surface they're already using and converts unstructured inputs into structured, actionable outputs through a review-first workflow.

**Core principle:** Users should not have to go into the app to use the app.

**Product definition:** Routing layer first, AI action engine second.

## 2. Problem Statement

Knowledge workers capture information across dozens of surfaces — email, Slack, screenshots, notes apps, browsers, PDFs. Turning that raw material into structured tasks requires manual re-entry, context switching, and cognitive overhead. Most tools force users into a specific app to organize their work, creating friction that reduces adoption.

## 3. Target Users

- Knowledge workers who receive actionable information across many channels
- Teams that need structured follow-ups from unstructured communication
- Individuals who want a single inbox for action items regardless of source

## 4. Product Principles

1. **Surface-native capture** — Meet users where they are, not where you want them
2. **Thin clients, fat pipeline** — Intelligence lives in the backend, clients are input/output shells
3. **Review-first** — Never take autonomous action; always present for human approval
4. **Source traceability** — Every output links back to where it came from
5. **Routing over storage** — Mailroom is a flow, not a database
6. **No drift into generic to-do** — The moat is capture + routing + normalization + extraction

## 5. Capture Surfaces

### MVP (Phases 3-4)
- **Web app** — Paste text, upload files (images, PDFs, screenshots), manual entry

### Phase 5 — Core External
- **Email** — Forward or CC a Mailroom address; system processes the email body + attachments
- **Slack** — Bot/slash command or message action to send content into Mailroom

### Phase 7 — Native Surfaces
- **iPhone app** — Lightweight capture-first app (camera, paste, voice note)
- **iOS share extension** — Share from any app into Mailroom
- **Apple Notes share flow** — Share notes directly into the pipeline
- **Chrome extension** — Right-click or popup to send selected text, page, or screenshot

### Phase 8 — Ambient
- **Desktop drag-and-drop bin** — Menubar/dock app; drop files, screenshots, text

### Phase 9 — Messaging (Future)
- SMS, Telegram, Discord, WhatsApp

## 6. Canonical Capture Object

Every input, regardless of source, is normalized into a single canonical format:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique capture identifier |
| `workspace_id` | UUID | Workspace/tenant |
| `user_id` | UUID | Capturing user |
| `source` | enum | Surface of origin (web, email, slack, ios, chrome, etc.) |
| `source_ref` | object | Source-specific metadata (email message-id, Slack ts, URL, etc.) |
| `content_type` | enum | text, image, pdf, screenshot, url, mixed |
| `raw_content` | object | Original content preserved as-is |
| `normalized_text` | string | Extracted/OCR'd text for pipeline processing |
| `attachments` | list | File references |
| `captured_at` | datetime | When content was captured |
| `status` | enum | pending, processing, review, approved, rejected |

## 7. Structured Output Schema

The extraction pipeline produces:

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Brief summary of the captured content |
| `next_steps` | list[string] | Identified next steps |
| `tasks` | list[Task] | Extracted tasks |
| `owners` | list[string] | Identified owners/assignees |
| `due_dates` | list[DueDate] | Extracted deadlines |
| `blockers` | list[string] | Identified blockers |
| `follow_ups` | list[FollowUp] | Required follow-ups |
| `priority` | enum | high, medium, low, none |
| `source_references` | list[SourceRef] | Links back to original content |

## 8. Core Workflow

```
[Any Surface] → Capture → Route → Normalize → Extract → Review → Approve/Reject → Save
```

1. **Capture** — User sends content from any surface
2. **Route** — System identifies user/workspace, authenticates
3. **Normalize** — Raw input converted to canonical capture object
4. **Extract** — AI model extracts structured outputs
5. **Review** — User sees extracted outputs in review UI (web app, inline reply, etc.)
6. **Approve/Reject** — User approves, edits, or rejects each extracted item
7. **Save** — Approved items saved as tasks with source traceability

## 9. Review-First Workflow

Mailroom never takes autonomous action. The review step is mandatory:

- Extracted outputs are always presented for human review
- Users can approve, edit, or reject individual items
- Batch approval is available but opt-in
- No auto-creation of tasks, no auto-assignment, no auto-notifications
- Review can happen in the web app or inline (e.g., Slack thread, email reply)

## 10. Non-Goals

- Mailroom is **not** a project management tool — it feeds into them
- Mailroom is **not** a to-do app — it extracts tasks, it doesn't manage them
- Mailroom is **not** a document store — it processes and routes, not archives
- Mailroom does **not** take autonomous action — review-first always
- Mailroom is **not** a chat interface — it's a capture and routing layer

## 11. Success Metrics

- **Capture-to-review latency** — Time from capture to structured output presented
- **Surface coverage** — Number of active capture surfaces per user
- **Approval rate** — Percentage of extracted items approved without editing
- **Multi-surface adoption** — Users capturing from 2+ surfaces
- **Time-to-first-capture** — Time from signup to first captured item

## 12. Future Considerations

- Integrations with project management tools (Linear, Jira, Asana, Notion)
- Workspace-level routing rules (auto-tag, auto-prioritize by source)
- Recurring capture patterns (daily standup summaries, weekly email digests)
- Team collaboration on review (shared review queues)
