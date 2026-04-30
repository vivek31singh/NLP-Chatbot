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
        # Use a simple alphanumeric sender_id (no UUIDs - Rasa regex handler chokes on hyphens)
        safe_sender = sender_id.replace("-", "")[:20]

        payload = {
            "message": message,
            "sender": "user",
        }

        try:
            response = await self.client.post(
                f"/conversations/{safe_sender}/messages",
                json=payload,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Rasa send error: {e.response.status_code} - {e.response.text}")
            return {"bot_messages": [], "error": str(e)}
        except httpx.ConnectError:
            logger.error("Cannot connect to Rasa server. Is it running on port 5005?")
            return {"bot_messages": [], "error": "Rasa server not reachable"}

        # Wait for Rasa to process
        import asyncio
        await asyncio.sleep(1.0)

        # Fetch bot responses
        try:
            bot_response = await self.get_response(safe_sender)
            return {"bot_messages": bot_response}
        except Exception as e:
            logger.error(f"Rasa get_response error: {e}")
            return {"bot_messages": [], "error": str(e)}

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
        """Check if Rasa server is healthy."""
        try:
            response = await self.client.get("/health", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self.client.aclose()


# Singleton instance
rasa_client = RasaClient()
