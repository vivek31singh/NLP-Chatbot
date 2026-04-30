from app.rasa_client import rasa_client
from app.models.models import Message, UncertainPrediction
from app.schemas.schemas import ChatMessageResponse
from sqlalchemy.orm import Session
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def process_message(
    message: str,
    sender_id: str,
    conversation_id: str,
    db: Session,
) -> ChatMessageResponse:
    """Process a user message through Rasa and store the response."""
    # Send message to Rasa
    result = await rasa_client.send_message(
        message=message,
        sender_id=sender_id,
        conversation_id=conversation_id,
    )

    # Check for errors
    if result.get("error"):
        logger.error(f"Rasa error: {result['error']}")
        bot_message = Message(
            conversation_id=conversation_id,
            sender_type="system",
            content="I'm having trouble connecting to the chatbot service. Please try again in a moment.",
        )
        db.add(bot_message)
        db.commit()
        db.refresh(bot_message)
        return ChatMessageResponse(
            conversation_id=conversation_id,
            message_id=bot_message.id,
            sender_type="system",
            content=bot_message.content,
            timestamp=bot_message.created_at,
        )

    bot_messages = result.get("bot_messages", [])

    if not bot_messages:
        return ChatMessageResponse(
            conversation_id=conversation_id,
            message_id=str(uuid.uuid4()),
            sender_type="bot",
            content="I'm sorry, I couldn't process your request. Please try again.",
            timestamp=datetime.utcnow(),
        )

    # Get the last bot message
    last_bot = bot_messages[-1]
    bot_text = last_bot.get("text", "")

    # Extract NLU data from parse_data if available
    parse_data = last_bot.get("parse_data") or {}
    intent_info = parse_data.get("intent", {}) or {}
    entities = parse_data.get("entities", []) or []
    confidence = intent_info.get("confidence")

    # Store bot message in database
    bot_message = Message(
        conversation_id=conversation_id,
        sender_type="bot",
        content=bot_text,
        intent=intent_info.get("name"),
        entities=entities,
        confidence=confidence,
    )
    db.add(bot_message)
    db.commit()
    db.refresh(bot_message)

    # Check for uncertain prediction (active learning)
    if confidence is not None and 0.3 <= confidence <= 0.6:
        uncertain = UncertainPrediction(
            text=message,
            predicted_intent=intent_info.get("name"),
            confidence=confidence,
        )
        db.add(uncertain)
        db.commit()

    return ChatMessageResponse(
        conversation_id=conversation_id,
        message_id=bot_message.id,
        sender_type="bot",
        content=bot_text,
        intent=intent_info.get("name"),
        entities=entities,
        confidence=confidence,
        timestamp=bot_message.created_at,
    )
