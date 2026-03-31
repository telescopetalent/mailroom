"""Webhook endpoints for email and Slack — unauthenticated, lookup-based."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.connectors.email import EmailConnector
from app.connectors.slack import SlackConnector
from app.core.database import get_db
from app.db.models import SurfaceConnectionRow
from app.pipeline.orchestrator import run_pipeline
from app.services.model_provider import get_model_provider

logger = logging.getLogger("mailroom.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _lookup_connection(db: Session, surface: str, external_id: str) -> SurfaceConnectionRow | None:
    """Find an active surface connection by surface type and external ID."""
    return (
        db.query(SurfaceConnectionRow)
        .filter(
            SurfaceConnectionRow.surface == surface,
            SurfaceConnectionRow.external_id == external_id,
            SurfaceConnectionRow.is_active == True,
        )
        .first()
    )


# ---------------------------------------------------------------------------
# Email webhook
# ---------------------------------------------------------------------------


@router.post("/email")
def email_webhook(
    request_body: dict[str, Any],
    db: Session = Depends(get_db),
):
    """Inbound email webhook.

    Accepts a JSON payload with email fields. Looks up the sender's
    email address in surface_connections to route to the right workspace.

    Stub format (for local testing):
        {"from": "user@example.com", "subject": "...", "body_text": "...", "message_id": "..."}
    """
    sender = request_body.get("from") or request_body.get("from_addr", "")
    if not sender:
        return JSONResponse({"status": "ignored", "reason": "no sender"})

    logger.info("Email webhook received from %s", sender)

    connection = _lookup_connection(db, "email", sender)
    if not connection:
        logger.info("No connection found for email sender %s", sender)
        return JSONResponse({"status": "ignored", "reason": "unregistered sender"})

    # Normalize the from field
    request_body["from_addr"] = sender

    connector = EmailConnector()
    pipeline_args = connector.parse_request(
        request_body,
        user_id=connection.user_id,
        workspace_id=connection.workspace_id,
    )

    provider = get_model_provider()

    try:
        capture, extraction = run_pipeline(
            user_id=connection.user_id,
            workspace_id=connection.workspace_id,
            provider=provider,
            db=db,
            **pipeline_args,
        )
        db.commit()
        logger.info("Email capture created: %s", capture.id)
        return JSONResponse({"status": "captured", "capture_id": str(capture.id)})
    except Exception:
        logger.exception("Email webhook pipeline failed for sender %s", sender)
        db.rollback()
        return JSONResponse({"status": "error", "reason": "pipeline failed"}, status_code=200)


# ---------------------------------------------------------------------------
# Slack webhook
# ---------------------------------------------------------------------------


@router.post("/slack")
async def slack_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Slack webhook — handles URL verification and slash commands.

    URL verification: POST with JSON {"type": "url_verification", "challenge": "..."}
    Slash command: POST with form-encoded data (team_id, text, channel_id, etc.)
    """
    content_type = request.headers.get("content-type", "")

    # JSON body — URL verification or event callback
    if "application/json" in content_type:
        body = await request.json()

        # Slack URL verification challenge
        if body.get("type") == "url_verification":
            return JSONResponse({"challenge": body.get("challenge", "")})

        # Event callback (future)
        logger.info("Slack JSON event received: type=%s", body.get("type"))
        return JSONResponse({"status": "ok"})

    # Form-encoded body — slash command
    form = await request.form()
    form_data = dict(form)

    team_id = form_data.get("team_id", "")
    text = form_data.get("text", "")
    command = form_data.get("command", "/mailroom")

    logger.info("Slack slash command received: team=%s command=%s", team_id, command)

    if not team_id:
        return JSONResponse({
            "response_type": "ephemeral",
            "text": "Error: missing team_id.",
        })

    if not text.strip():
        return JSONResponse({
            "response_type": "ephemeral",
            "text": "Usage: /mailroom <text to capture>",
        })

    connection = _lookup_connection(db, "slack", team_id)
    if not connection:
        logger.info("No connection found for Slack team %s", team_id)
        return JSONResponse({
            "response_type": "ephemeral",
            "text": "This Slack workspace is not connected to Mailroom. Connect it in Mailroom Settings.",
        })

    connector = SlackConnector()
    pipeline_args = connector.parse_request(
        form_data,
        user_id=connection.user_id,
        workspace_id=connection.workspace_id,
    )

    provider = get_model_provider()

    try:
        capture, extraction = run_pipeline(
            user_id=connection.user_id,
            workspace_id=connection.workspace_id,
            provider=provider,
            db=db,
            **pipeline_args,
        )
        db.commit()
        logger.info("Slack capture created: %s", capture.id)
        return JSONResponse({
            "response_type": "ephemeral",
            "text": f"Captured! Your content is being processed. Check Mailroom to review.",
        })
    except Exception:
        logger.exception("Slack webhook pipeline failed for team %s", team_id)
        db.rollback()
        return JSONResponse({
            "response_type": "ephemeral",
            "text": "Something went wrong processing your capture. Please try again.",
        })
