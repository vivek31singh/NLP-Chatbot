from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatMessageRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    session_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    conversation_id: str
    message_id: str
    sender_type: str
    content: str
    intent: Optional[str] = None
    entities: Optional[list] = None
    confidence: Optional[float] = None
    timestamp: datetime


class FeedbackRequest(BaseModel):
    message_id: Optional[str] = None
    conversation_id: str
    rating: int  # 1-5
    comment: Optional[str] = None


class ConversationResponse(BaseModel):
    id: str
    session_id: str
    channel: str
    status: str
    created_at: datetime
    message_count: Optional[int] = None


class AnnotationRequest(BaseModel):
    text: str
    correct_intent: str
    original_intent: Optional[str] = None


class TrainRequest(BaseModel):
    config: Optional[str] = None


class AnalyticsOverview(BaseModel):
    total_conversations: int
    active_conversations: int
    bot_resolution_rate: float
    avg_confidence: float
    fallback_rate: float
    avg_satisfaction: Optional[float] = None
    total_messages: int


class IntentMetric(BaseModel):
    intent: str
    count: int
    avg_confidence: float


class HealthResponse(BaseModel):
    status: str
    rasa_connected: bool
    database_connected: bool
