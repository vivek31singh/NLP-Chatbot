import os

PATCH_FILE = "/opt/venv/lib/python3.10/site-packages/rasa/nlu/classifiers/regex_message_handler.py"

patch_content = '''from __future__ import annotations
import logging
from typing import Any, Dict, Optional, Text, List

from rasa.engine.graph import GraphComponent, ExecutionContext
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.shared.nlu.training_data.message import Message

logger = logging.getLogger(__name__)


@DefaultV1Recipe.register(
    DefaultV1Recipe.ComponentType.INTENT_CLASSIFIER, is_trainable=False
)
class RegexMessageHandler(GraphComponent):
    def __init__(self) -> None:
        pass

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "RegexMessageHandler":
        return cls()

    def process(
        self, messages: List[Message], domain: Optional[Any] = None
    ) -> List[Message]:
        return messages
'''

try:
    with open(PATCH_FILE, "w") as f:
        f.write(patch_content)
    print("Patched RegexMessageHandler successfully")
except PermissionError:
    print("Cannot patch RegexMessageHandler (permission denied), skipping")
