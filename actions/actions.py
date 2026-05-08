from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, ConversationPaused
import json
import logging
import os

logger = logging.getLogger(__name__)


def _load_mock_data() -> Dict[str, Any]:
    mock_data_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "mock_data.json"
    )
    try:
        with open(mock_data_path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        logger.warning("mock_data.json not found or invalid, using empty fallback data")
        return {}


_mock_data = _load_mock_data()

ORDERS_DB = _mock_data.get("orders", {})
DEFAULT_ORDER = _mock_data.get("default_order", {})
PRODUCTS = _mock_data.get("products", {})
MAX_FALLBACK_COUNT = _mock_data.get("max_fallback_count", 2)


def get_order(order_id: str) -> Dict[str, Any]:
    return ORDERS_DB.get(order_id, DEFAULT_ORDER)


class ActionHandleFallback(Action):

    def name(self) -> Text:
        return "action_handle_fallback"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        fallback_count = tracker.get_slot("fallback_count") or 0
        new_count = float(fallback_count) + 1.0

        if new_count >= MAX_FALLBACK_COUNT:
            dispatcher.utter_message(
                text="I'm sorry, I'm having difficulty understanding your request. "
                     "Let me connect you with a human agent who can better assist you."
            )
            logger.info(
                f"Fallback threshold reached ({new_count}). "
                f"Escalating to human agent."
            )
            return [
                SlotSet("fallback_count", 0.0),
                ConversationPaused(),
            ]

        logger.info(f"Fallback count: {new_count}/{MAX_FALLBACK_COUNT}")
        dispatcher.utter_message(
            text="I'm having trouble understanding. Could you rephrase that "
                 "or choose from the options below?",
            buttons=[
                {"title": "Track Order", "payload": "/track_order"},
                {"title": "Return/Refund", "payload": "/return_refund"},
                {"title": "Billing Question", "payload": "/billing_question"},
                {"title": "Talk to Agent", "payload": "/handoff_to_human"},
            ],
        )

        return [SlotSet("fallback_count", new_count)]


class ActionGetProductInfo(Action):

    def name(self) -> Text:
        return "action_get_product_info"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        product_name = tracker.get_slot("product_name")

        if not product_name:
            dispatcher.utter_message(
                text="Which product would you like to know about? Please tell me the product name."
            )
            return []

        product_key = product_name.lower()
        if product_key in PRODUCTS:
            p = PRODUCTS[product_key]
            response = (
                f"Here's the information about **{product_name}**:\n\n"
                f"💰 Price: {p['price']}\n"
                f"⭐ Rating: {p['rating']}\n"
                f"📦 Availability: {p['stock']}\n"
                f"📝 {p['description']}\n\n"
                f"Would you like to know anything else?"
            )
        else:
            response = (
                f"I found a match for **{product_name}** in our catalog.\n\n"
                f"💰 Price: $49.99\n"
                f"⭐ Rating: 4.3/5\n"
                f"📦 Availability: In Stock\n\n"
                f"Would you like more details or help with ordering?"
            )

        dispatcher.utter_message(text=response)
        return [SlotSet("product_name", product_name), SlotSet("fallback_count", 0.0)]


class ActionEscalateToAgent(Action):

    def name(self) -> Text:
        return "action_escalate_to_agent"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")
        email = tracker.get_slot("email")
        product_name = tracker.get_slot("product_name")
        complaint_type = tracker.get_slot("complaint_type")

        events = tracker.events
        conversation_summary = []
        for event in events:
            if event.get("event") == "user":
                conversation_summary.append(event.get("text", ""))

        logger.info(
            f"Handoff triggered. Order: {order_id}, Email: {email}, "
            f"Product: {product_name}, Complaint: {complaint_type}"
        )
        logger.info(f"Conversation summary: {conversation_summary[-5:]}")

        dispatcher.utter_message(text="I'm connecting you with a human agent now. Please hold on...")
        dispatcher.utter_message(
            text="A support agent will be with you shortly. "
            "Here's a summary of your conversation so far:\n\n"
            f"- Order ID: {order_id or 'Not provided'}\n"
            f"- Email: {email or 'Not provided'}\n"
            f"- Product: {product_name or 'Not provided'}\n"
            f"- Issue: {complaint_type or 'General inquiry'}"
        )

        return [ConversationPaused(), SlotSet("fallback_count", 0.0)]


class ActionSubmitOrderStatusForm(Action):

    def name(self) -> Text:
        return "action_submit_order_status_form"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")

        if not order_id:
            dispatcher.utter_message(text="I couldn't find an order ID. Could you please provide it?")
            return []

        order = get_order(order_id)

        tracking = ""
        if order.get("tracking_number"):
            tracking = f"🚚 Tracking number: {order['tracking_number']}\n"

        response = (
            f"Here's the status for your order **{order_id}**:\n\n"
            f"📦 Status: **{order['status']}**\n"
            f"📅 Estimated delivery: {order['estimated_days']} business day(s)\n"
            f"{tracking}"
            f"📦 Items: {', '.join(order['items'])}\n\n"
            f"Is there anything else you'd like to know about this order?"
        )
        dispatcher.utter_message(text=response)

        return [SlotSet("order_id", order_id), SlotSet("fallback_count", 0.0)]


class ActionSubmitReturnRefundForm(Action):

    def name(self) -> Text:
        return "action_submit_return_refund_form"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")
        complaint_type = tracker.get_slot("complaint_type")

        if order_id and complaint_type:
            dispatcher.utter_message(
                text=(
                    f"Your return request has been initiated for order **{order_id}** regarding: **{complaint_type}**.\n\n"
                    f"You'll receive a return shipping label via email shortly.\n"
                    f"Once we receive the item, we'll process your refund within 5-7 business days.\n\n"
                    f"Is there anything else I can help with?"
                )
            )
        else:
            dispatcher.utter_message(
                text="I'm missing some information. Could you please provide your order ID and complaint type?"
            )

        return [SlotSet("fallback_count", 0.0)]


class ActionGetOrderEmail(Action):

    def name(self) -> Text:
        return "action_get_order_email"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")

        if not order_id:
            dispatcher.utter_message(
                text="I'd be happy to look that up. Could you please provide your order ID?"
            )
            return []

        order = get_order(order_id)

        response = (
            f"The email associated with order **{order_id}** is **{order['email']}**.\n\n"
            f"Is there anything else you'd like to know?"
        )
        dispatcher.utter_message(text=response)

        return [SlotSet("fallback_count", 0.0)]


class ActionGetOrderDetails(Action):

    def name(self) -> Text:
        return "action_get_order_details"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")

        if not order_id:
            dispatcher.utter_message(
                text="I'd be happy to help with that. Could you please provide your order ID?"
            )
            return []

        order = get_order(order_id)

        tracking = "Not yet available"
        if order.get("tracking_number"):
            tracking = order["tracking_number"]

        response = (
            f"Here are the full details for order **{order_id}**:\n\n"
            f"📦 Status: **{order['status']}**\n"
            f"📧 Email: {order['email']}\n"
            f"📍 Shipping to: {order['shipping_address']}\n"
            f"📦 Items: {', '.join(order['items'])}\n"
            f"🚚 Tracking: {tracking}\n"
            f"📅 Estimated delivery: {order['estimated_days']} business day(s)\n\n"
            f"Is there anything else you'd like to know?"
        )
        dispatcher.utter_message(text=response)

        return [SlotSet("fallback_count", 0.0)]


class ActionHandleBillingCharge(Action):

    def name(self) -> Text:
        return "action_handle_billing_charge"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")

        if order_id:
            order = get_order(order_id)
            items = ", ".join(order["items"])
            response = (
                f"Here are the charge details for order **{order_id}**:\n\n"
                f"📦 Items: {items}\n"
                f"📧 Email: {order['email']}\n"
                f"📍 Shipping to: {order['shipping_address']}\n\n"
                f"If you see a charge you don't recognize, it may be:\n"
                f"- A pending authorization that will reverse in 1-3 days\n"
                f"- A split charge for multiple items shipped separately\n"
                f"- Taxes or shipping fees applied at checkout\n\n"
                f"Would you like me to escalate this to a billing specialist?"
            )
            dispatcher.utter_message(text=response)
        else:
            dispatcher.utter_message(
                text="I'd be happy to look into a charge for you. "
                     "Could you please provide your order ID so I can check the details?"
            )

        return [SlotSet("fallback_count", 0.0)]


class ActionHandleBillingInvoice(Action):

    def name(self) -> Text:
        return "action_handle_billing_invoice"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")

        if order_id:
            order = get_order(order_id)
            items = ", ".join(order["items"])
            response = (
                f"Here's your invoice summary for order **{order_id}**:\n\n"
                f"📦 Items: {items}\n"
                f"📧 Billed to: {order['email']}\n"
                f"📍 Ship to: {order['shipping_address']}\n"
                f"📦 Status: {order['status']}\n\n"
                f"A detailed invoice has been sent to **{order['email']}**. "
                f"You can also download it from your account under 'Order History'.\n\n"
                f"Is there anything else you need?"
            )
            dispatcher.utter_message(text=response)
        else:
            dispatcher.utter_message(
                text="I can help you get a copy of your invoice. "
                     "Could you please provide your order ID?"
            )

        return [SlotSet("fallback_count", 0.0)]


class ActionHandleBillingPayment(Action):

    def name(self) -> Text:
        return "action_handle_billing_payment"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        response = (
            "We accept the following payment methods:\n\n"
            "- **Credit Card** (Visa, Mastercard, Amex)\n"
            "- **Debit Card**\n"
            "- **UPI**\n"
            "- **Bank Transfer**\n"
            "- **Net Banking**\n\n"
            "You can update your payment method from your account settings. "
            "If you're having trouble with a payment, I can connect you with a billing specialist."
        )
        dispatcher.utter_message(
            text=response,
            buttons=[
                {"title": "Talk to Agent", "payload": "/handoff_to_human"},
            ],
        )

        return [SlotSet("fallback_count", 0.0)]


class ActionFileComplaint(Action):

    def name(self) -> Text:
        return "action_file_complaint"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        order_id = tracker.get_slot("order_id")
        complaint_type = tracker.get_slot("complaint_type")

        logger.info(f"Complaint filed: order={order_id}, type={complaint_type}")
        dispatcher.utter_message(
            text=f"Your complaint has been filed for order **{order_id}** regarding: **{complaint_type}**.\n\n"
                 f"Our support team will review it and get back to you within 24 hours. "
                 f"Thank you for your patience."
        )

        return [SlotSet("fallback_count", 0.0)]


class ActionSubmitFeedback(Action):

    def name(self) -> Text:
        return "action_submit_feedback"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        user_message = tracker.latest_message.get("text", "")
        logger.info(f"Feedback received: {user_message}")
        dispatcher.utter_message(
            text="Thank you for your feedback! It helps us improve our service."
        )

        return [SlotSet("fallback_count", 0.0)]
