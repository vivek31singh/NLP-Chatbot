import httpx
import logging
from app.config import settings
from typing import Optional

logger = logging.getLogger(__name__)


class RasaClient:
    """Client for communicating with the Rasa server."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.rasa_url
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)

    async def send_message(
        self, message: str, sender_id: str, conversation_id: Optional[str] = None
    ) -> dict:
        """Send a message to Rasa and get the bot's response."""
        safe_sender = sender_id.replace("-", "")[:20]

        try:
            parse_data = await self.parse_message(message)
            intent_name = parse_data.get("intent", {}).get("name")
            entities = parse_data.get("entities", [])
            confidence = parse_data.get("intent", {}).get("confidence")
        except Exception as e:
            logger.error(f"Rasa parse error: {e}")
            return {"bot_messages": [], "error": str(e)}

        if not intent_name or intent_name == "nlu_fallback":
            return {"bot_messages": [], "parse_data": parse_data}

        try:
            trigger_resp = await self.client.post(
                f"/conversations/{safe_sender}/trigger_intent",
                json={"name": intent_name, "entities": entities},
                timeout=30.0,
            )
            trigger_resp.raise_for_status()
            result = trigger_resp.json()
            bot_messages = result.get("messages", [])
            for msg in bot_messages:
                msg["parse_data"] = parse_data
                msg["confidence"] = confidence
            return {"bot_messages": bot_messages, "parse_data": parse_data}
        except Exception as e:
            logger.error(f"Rasa trigger_intent error: {e}")
            return {"bot_messages": [], "error": str(e), "parse_data": parse_data}

    async def get_response(self, sender_id: str) -> list:
        """Get the latest bot responses from Rasa."""
        response = await self.client.get(
            f"/conversations/{sender_id}/tracker",
        )
        response.raise_for_status()
        tracker = response.json()

        # Extract bot messages from tracker events
        bot_messages = []
        for event in tracker.get("events", []):
            if event.get("event") == "bot" and event.get("text"):
                bot_messages.append(event)

        return bot_messages

    async def parse_message(self, message: str) -> dict:
        """Parse a message through Rasa NLU without sending it."""
        payload = {"text": message}
        response = await self.client.post("/model/parse", json=payload)
        response.raise_for_status()
        return response.json()

    async def health_check(self) -> bool:
        try:
            response = await self.client.get("/version", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self.client.aclose()


# Singleton instance
rasa_client = RasaClient()
