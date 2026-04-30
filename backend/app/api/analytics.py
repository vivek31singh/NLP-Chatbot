from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import Conversation, Message, Feedback
from app.schemas.schemas import AnalyticsOverview, IntentMetric
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(db: Session = Depends(get_db)):
    """Get dashboard overview metrics."""
    total_conversations = db.query(Conversation).count()
    active_conversations = db.query(Conversation).filter_by(status="active").count()
    resolved_conversations = db.query(Conversation).filter_by(status="resolved").count()
    handoff_conversations = db.query(Conversation).filter_by(status="handoff").count()
    total_messages = db.query(Message).count()

    # Bot resolution rate
    completed = resolved_conversations + handoff_conversations
    bot_resolution_rate = (
        (resolved_conversations / completed * 100) if completed > 0 else 0.0
    )

    # Average confidence
    avg_confidence_result = db.query(func.avg(Message.confidence)).filter(
        Message.sender_type == "bot", Message.confidence.isnot(None)
    ).scalar()
    avg_confidence = round(avg_confidence_result or 0.0, 4)

    # Fallback rate
    fallback_messages = db.query(Message).filter(
        Message.sender_type == "bot",
        Message.content.contains("rephrase"),
    ).count()
    bot_messages = db.query(Message).filter(Message.sender_type == "bot").count()
    fallback_rate = (
        (fallback_messages / bot_messages * 100) if bot_messages > 0 else 0.0
    )

    # Average satisfaction
    avg_satisfaction_result = db.query(func.avg(Feedback.rating)).scalar()
    avg_satisfaction = round(avg_satisfaction_result, 2) if avg_satisfaction_result else None

    return AnalyticsOverview(
        total_conversations=total_conversations,
        active_conversations=active_conversations,
        bot_resolution_rate=round(bot_resolution_rate, 2),
        avg_confidence=avg_confidence,
        fallback_rate=round(fallback_rate, 2),
        avg_satisfaction=avg_satisfaction,
        total_messages=total_messages,
    )


@router.get("/intents", response_model=list[IntentMetric])
async def get_intent_distribution(db: Session = Depends(get_db)):
    """Get intent distribution statistics."""
    results = (
        db.query(
            Message.intent,
            func.count(Message.id).label("count"),
            func.avg(Message.confidence).label("avg_confidence"),
        )
        .filter(Message.intent.isnot(None), Message.sender_type == "bot")
        .group_by(Message.intent)
        .order_by(func.count(Message.id).desc())
        .all()
    )

    return [
        IntentMetric(
            intent=r.intent,
            count=r.count,
            avg_confidence=round(r.avg_confidence, 4) if r.avg_confidence else 0.0,
        )
        for r in results
    ]


@router.get("/conversations/trend")
async def get_conversation_trend(days: int = 30, db: Session = Depends(get_db)):
    """Get conversation volume trend over time."""
    since = datetime.utcnow() - timedelta(days=days)
    results = (
        db.query(
            func.date(Conversation.created_at).label("date"),
            func.count(Conversation.id).label("count"),
        )
        .filter(Conversation.created_at >= since)
        .group_by(func.date(Conversation.created_at))
        .order_by(func.date(Conversation.created_at))
        .all()
    )

    return [{"date": str(r.date), "count": r.count} for r in results]


@router.get("/satisfaction")
async def get_satisfaction_scores(db: Session = Depends(get_db)):
    """Get user satisfaction scores."""
    results = (
        db.query(
            Feedback.rating,
            func.count(Feedback.id).label("count"),
        )
        .group_by(Feedback.rating)
        .order_by(Feedback.rating)
        .all()
    )

    return [{"rating": r.rating, "count": r.count} for r in results]


@router.get("/fallback-messages")
async def get_fallback_messages(limit: int = 50, db: Session = Depends(get_db)):
    """Get messages that triggered fallback for training data improvement."""
    # Get user messages that preceded a fallback response
    fallback_bot_ids = (
        db.query(Message.id, Message.conversation_id, Message.created_at)
        .filter(
            Message.sender_type == "bot",
            Message.content.contains("rephrase"),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for fb in fallback_bot_ids:
        # Find the user message before this fallback
        user_msg = (
            db.query(Message)
            .filter(
                Message.conversation_id == fb.conversation_id,
                Message.sender_type == "user",
                Message.created_at < fb.created_at,
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        if user_msg:
            results.append({
                "user_message": user_msg.content,
                "intent": user_msg.intent,
                "confidence": user_msg.confidence,
                "conversation_id": fb.conversation_id,
                "timestamp": fb.created_at.isoformat(),
            })

    return results
