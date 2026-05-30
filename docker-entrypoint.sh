#!/bin/bash
set -e

python3 /app/patch_regex_handler.py 2>/dev/null || python /app/patch_regex_handler.py 2>/dev/null || true

if [ "$1" = "run" ]; then
    exec rasa "$@"
else
    exec rasa "$@"
fi
