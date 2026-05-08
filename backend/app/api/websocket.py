import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.models import Conversation, Message
from app.rasa_client import rasa_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, sender_id: str):
        await websocket.accept()
        self.active_connections[sender_id] = websocket

    def disconnect(self, sender_id: str):
        self.active_connections.pop(sender_id, None)

    async def send_json(self, sender_id: str, data: dict):
        ws = self.active_connections.get(sender_id)
        if ws:
            await ws.send_json(data)


manager = ConnectionManager()


def _get_or_create_conversation(db: Session, sender_id: str) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter_by(session_id=sender_id, status="active")
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if not conversation:
        conversation = Conversation(session_id=sender_id, channel="websocket")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    return conversation


@router.websocket("/api/v1/chat/websocket")
async def websocket_chat(
    websocket: WebSocket,
    sender_id: str = Query(...),
):
    await manager.connect(websocket, sender_id)
    db: Optional[Session] = None
    try:
        db = SessionLocal()
        conversation = _get_or_create_conversation(db, sender_id)
        await manager.send_json(sender_id, {
            "type": "connected",
            "conversation_id": conversation.id,
        })
        logger.info(f"WebSocket connected: sender_id={sender_id}, conversation_id={conversation.id}")

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                user_text = data.get("message", "").strip()
            except json.JSONDecodeError:
                await manager.send_json(sender_id, {
                    "response": "Please send valid JSON with a 'message' field.",
                    "error": "invalid_json",
                })
                continue

            if not user_text:
                await manager.send_json(sender_id, {
                    "response": "Message cannot be empty.",
                    "error": "empty_message",
                })
                continue

            user_message = Message(
                conversation_id=conversation.id,
                sender_type="user",
                content=user_text,
            )
            db.add(user_message)
            db.commit()

            result = await rasa_client.send_message(
                message=user_text,
                sender_id=sender_id,
                conversation_id=conversation.id,
            )

            if result.get("error"):
                bot_text = "I'm having trouble connecting to the chatbot service. Please try again."
                intent = None
                confidence = None
                logger.error(f"Rasa error for {sender_id}: {result['error']}")
            else:
                bot_messages = result.get("bot_messages", [])
                if bot_messages:
                    last_bot = bot_messages[-1]
                    bot_text = last_bot.get("text", "I couldn't process your request.")
                    parse_data = last_bot.get("parse_data") or {}
                    intent_info = parse_data.get("intent") or {}
                    intent = intent_info.get("name")
                    confidence = intent_info.get("confidence")
                else:
                    bot_text = "I'm sorry, I couldn't process your request. Please try again."
                    intent = None
                    confidence = None

            bot_message = Message(
                conversation_id=conversation.id,
                sender_type="bot",
                content=bot_text,
                intent=intent,
                confidence=confidence,
            )
            db.add(bot_message)
            db.commit()

            await manager.send_json(sender_id, {
                "response": bot_text,
                "intent": intent,
                "confidence": confidence,
            })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: sender_id={sender_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {sender_id}: {e}")
        try:
            await manager.send_json(sender_id, {
                "response": "An internal error occurred. Please reconnect.",
                "error": "internal_error",
            })
        except Exception:
            pass
    finally:
        manager.disconnect(sender_id)
        if db:
            try:
                conversation = (
                    db.query(Conversation)
                    .filter_by(session_id=sender_id, status="active")
                    .order_by(Conversation.created_at.desc())
                    .first()
                )
                if conversation:
                    conversation.status = "closed"
                    db.commit()
            except Exception as e:
                logger.error(f"Failed to close conversation for {sender_id}: {e}")
            finally:
                db.close()
