from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Handoff, Conversation, Message
from app.schemas.schemas import HandoffAcceptRequest, HandoffMessageRequest, HandoffCloseRequest, HandoffCreateRequest
from datetime import datetime

router = APIRouter(prefix="/api/v1/handoffs", tags=["handoffs"])


@router.post("")
async def create_handoff(request: HandoffCreateRequest, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter_by(id=request.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    handoff = Handoff(
        conversation_id=request.conversation_id,
        reason=request.reason,
    )
    db.add(handoff)
    db.commit()
    db.refresh(handoff)

    return {
        "success": True,
        "id": handoff.id,
        "conversation_id": handoff.conversation_id,
        "status": handoff.status,
        "queued_at": handoff.queued_at.isoformat() if handoff.queued_at else None,
    }


@router.get("")
async def list_pending_handoffs(db: Session = Depends(get_db)):
    handoffs = (
        db.query(Handoff)
        .filter_by(status="pending")
        .order_by(Handoff.queued_at.asc())
        .all()
    )
    result = []
    for h in handoffs:
        conversation = db.query(Conversation).filter_by(id=h.conversation_id).first()
        result.append({
            "id": h.id,
            "conversation_id": h.conversation_id,
            "sender_id": conversation.session_id if conversation else None,
            "queued_at": h.queued_at.isoformat() if h.queued_at else None,
            "reason": h.reason,
        })
    return result


@router.post("/{handoff_id}/accept")
async def accept_handoff(handoff_id: int, request: HandoffAcceptRequest, db: Session = Depends(get_db)):
    handoff = db.query(Handoff).filter_by(id=handoff_id).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")

    if handoff.status != "pending":
        raise HTTPException(status_code=400, detail="Handoff is not pending")

    handoff.status = "accepted"
    handoff.accepted_at = datetime.utcnow()
    handoff.accepted_by = request.agent_id

    conversation = db.query(Conversation).filter_by(id=handoff.conversation_id).first()
    if conversation:
        conversation.status = "handoff"

    db.commit()
    db.refresh(handoff)

    return {
        "success": True,
        "conversation": {
            "id": conversation.id,
            "session_id": conversation.session_id,
            "status": conversation.status,
        } if conversation else None,
    }


@router.post("/{handoff_id}/message")
async def send_agent_message(handoff_id: int, request: HandoffMessageRequest, db: Session = Depends(get_db)):
    handoff = db.query(Handoff).filter_by(id=handoff_id).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")

    if handoff.status != "accepted":
        raise HTTPException(status_code=400, detail="Handoff must be accepted before sending messages")

    agent_message = Message(
        conversation_id=handoff.conversation_id,
        sender_type="agent",
        content=request.message,
    )
    db.add(agent_message)
    db.commit()

    return {"success": True}


@router.post("/{handoff_id}/close")
async def close_handoff(handoff_id: int, request: HandoffCloseRequest, db: Session = Depends(get_db)):
    handoff = db.query(Handoff).filter_by(id=handoff_id).first()
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")

    if handoff.status != "accepted":
        raise HTTPException(status_code=400, detail="Handoff must be accepted before closing")

    handoff.status = "closed"
    handoff.closed_at = datetime.utcnow()

    conversation = db.query(Conversation).filter_by(id=handoff.conversation_id).first()
    if conversation:
        conversation.status = "resolved"
        conversation.resolved_by = "agent"
        conversation.handed_off = True
        conversation.ended_at = datetime.utcnow()

    db.commit()

    return {"success": True}
