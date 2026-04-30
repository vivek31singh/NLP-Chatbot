from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, ConversationPaused
import logging

logger = logging.getLogger(__name__)

ORDERS_DB = {
    "ORD-12345": {
        "status": "Shipped",
        "estimated_days": 3,
        "email": "john.doe@email.com",
        "shipping_address": "123 Main St, New York, NY 10001",
        "items": ["Wireless Headphones", "Phone Case"],
        "tracking_number": "TRK-9876543210",
    },
    "ORD-67890": {
        "status": "Delivered",
        "estimated_days": 0,
        "email": "jane.smith@email.com",
        "shipping_address": "456 Oak Ave, Los Angeles, CA 90001",
        "items": ["Mechanical Keyboard"],
        "tracking_number": "TRK-1234567890",
    },
    "ORD-11111": {
        "status": "Processing",
        "estimated_days": 5,
        "email": "bob.wilson@email.com",
        "shipping_address": "789 Pine Rd, Chicago, IL 60601",
        "items": ["Laptop Stand", "USB-C Hub"],
        "tracking_number": None,
    },
    "ORD-22222": {
        "status": "In Transit",
        "estimated_days": 2,
        "email": "alice.jones@email.com",
        "shipping_address": "321 Elm St, Houston, TX 77001",
        "items": ["Smart Watch"],
        "tracking_number": "TRK-5556667778",
    },
    "ORD-33333": {
        "status": "Out for Delivery",
        "estimated_days": 1,
        "email": "charlie.brown@email.com",
        "shipping_address": "654 Maple Dr, Phoenix, AZ 85001",
        "items": ["Bluetooth Speaker", "Desk Lamp"],
        "tracking_number": "TRK-1122334455",
    },
}

DEFAULT_ORDER = {
    "status": "Processing",
    "estimated_days": 5,
    "email": "customer@email.com",
    "shipping_address": "Default Address",
    "items": ["Item"],
    "tracking_number": "TRK-0000000000",
}


def get_order(order_id: str) -> Dict[str, Any]:
    return ORDERS_DB.get(order_id, DEFAULT_ORDER)


class ActionCheckOrderStatus(Action):

    def name(self) -> Text:
        return "action_check_order_status"

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

        response = (
            f"Here's the status for your order **{order_id}**:\n\n"
            f"📦 Status: **{order['status']}**\n"
            f"📅 Estimated delivery: {order['estimated_days']} business day(s)\n"
            f"📍 Tracking: Your package is on its way!\n\n"
            f"Is there anything else you'd like to know about this order?"
        )
        dispatcher.utter_message(text=response)

        return [SlotSet("order_id", order_id)]


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

        products = {
            "wireless headphones": {
                "price": "$79.99",
                "rating": "4.5/5",
                "stock": "In Stock",
                "description": "Premium wireless headphones with noise cancellation, 30-hour battery life, and comfortable over-ear design.",
            },
            "laptop stand": {
                "price": "$39.99",
                "rating": "4.7/5",
                "stock": "In Stock",
                "description": "Adjustable aluminum laptop stand with ergonomic design, compatible with all laptops up to 17 inches.",
            },
            "mechanical keyboard": {
                "price": "$129.99",
                "rating": "4.8/5",
                "stock": "Low Stock",
                "description": "RGB mechanical keyboard with Cherry MX switches, hot-swappable keys, and USB-C connectivity.",
            },
        }

        product_key = product_name.lower()
        if product_key in products:
            p = products[product_key]
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
        return [SlotSet("product_name", product_name)]


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

        return [ConversationPaused()]


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

        return [SlotSet("order_id", order_id)]


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
        email = tracker.get_slot("email")

        if order_id and email:
            dispatcher.utter_message(
                text=(
                    f"Here's our return and refund process:\n\n"
                    f"1. Your return request has been initiated for order **{order_id}**.\n"
                    f"2. You'll receive a return shipping label at **{email}**.\n"
                    f"3. Once we receive the item, we'll process your refund within 5-7 business days.\n\n"
                    f"Is there anything else I can help with?"
                )
            )
        else:
            dispatcher.utter_message(
                text="I'm missing some information. Could you please provide your order ID and email address?"
            )

        return []


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

        return []


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

        return []
