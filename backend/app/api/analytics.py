import json
import logging
import os
import subprocess
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import Conversation, Message, Feedback
from app.schemas.schemas import AnalyticsOverview, IntentMetric
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


@router.get("/evaluation")
async def get_evaluation_results():
    """Run NLU evaluation and return structured results."""
    results_dir = os.path.join(PROJECT_DIR, "results")
    os.makedirs(results_dir, exist_ok=True)

    try:
        process = subprocess.run(
            ["rasa", "test", "nlu", "--out", "results/"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if process.returncode != 0:
            logger.error(f"rasa test nlu failed: {process.stderr}")
    except subprocess.TimeoutExpired:
        logger.error("rasa test nlu timed out after 300s")
    except FileNotFoundError:
        logger.error("rasa CLI not found")

    response = {
        "f1_scores": {"weighted": None, "macro": None, "micro": None},
        "confusion_matrix_url": None,
        "intent_report": {},
        "note": None,
    }

    confusion_matrix_path = os.path.join(results_dir, "intent_confusion_matrix.png")
    if os.path.exists(confusion_matrix_path):
        response["confusion_matrix_url"] = "/results/intent_confusion_matrix.png"

    report_path = os.path.join(results_dir, "intent_report.json")
    if os.path.exists(report_path):
        try:
            with open(report_path, "r") as f:
                report = json.load(f)

            for intent_name, metrics in report.items():
                if intent_name in ("accuracy", "weighted avg", "macro avg", "micro avg"):
                    continue
                response["intent_report"][intent_name] = {
                    "precision": metrics.get("precision"),
                    "recall": metrics.get("recall"),
                    "f1_score": metrics.get("f1-score"),
                    "support": metrics.get("support"),
                }

            if "weighted avg" in report:
                response["f1_scores"]["weighted"] = round(report["weighted avg"]["f1-score"], 4)
            if "macro avg" in report:
                response["f1_scores"]["macro"] = round(report["macro avg"]["f1-score"], 4)
            if "micro avg" in report:
                response["f1_scores"]["micro"] = round(report["micro avg"]["f1-score"], 4)
            if "accuracy" in report:
                response["f1_scores"]["accuracy"] = round(report["accuracy"]["f1-score"], 4)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"Failed to parse intent report: {e}")
            response["note"] = "Evaluation ran but report parsing failed."
    else:
        response["note"] = "Evaluation completed but no intent_report.json found. Ensure test data is available."

    return response
