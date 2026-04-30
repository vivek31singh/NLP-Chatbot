from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.rasa_client import rasa_client
from app.schemas.schemas import ChatMessageRequest, ChatMessageResponse, FeedbackRequest
from app.models.models import Conversation, Message, Feedback
from app.services.chat_service import process_message
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(request: ChatMessageRequest, db: Session = Depends(get_db)):
    """Send a message and get the bot's response."""
    # Get or create conversation
    conversation_id = request.conversation_id
    if not conversation_id:
        conversation = Conversation(
            session_id=request.session_id or str(uuid.uuid4()),
            channel="web",
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        conversation_id = conversation.id
    else:
        conversation = db.query(Conversation).filter_by(id=conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

    # Store user message
    user_message = Message(
        conversation_id=conversation_id,
        sender_type="user",
        content=request.message,
    )
    db.add(user_message)
    db.commit()

    # Process through Rasa
    bot_response = await process_message(
        message=request.message,
        sender_id=conversation.session_id,
        conversation_id=conversation_id,
        db=db,
    )

    return bot_response


@router.get("/conversations", response_model=list)
async def list_conversations(db: Session = Depends(get_db)):
    """List all conversations."""
    conversations = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
    result = []
    for c in conversations:
        msg_count = db.query(Message).filter_by(conversation_id=c.id).count()
        result.append({
            "id": c.id,
            "session_id": c.session_id,
            "channel": c.channel,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
            "message_count": msg_count,
        })
    return result


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Get all messages for a conversation."""
    messages = (
        db.query(Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "sender_type": m.sender_type,
            "content": m.content,
            "intent": m.intent,
            "entities": m.entities,
            "confidence": m.confidence,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest, db: Session = Depends(get_db)):
    """Submit feedback for a conversation."""
    feedback = Feedback(
        message_id=request.message_id,
        conversation_id=request.conversation_id,
        rating=request.rating,
        comment=request.comment,
    )
    db.add(feedback)
    db.commit()
    return {"status": "success", "message": "Feedback recorded. Thank you!"}
