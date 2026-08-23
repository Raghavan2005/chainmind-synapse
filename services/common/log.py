from __future__ import annotations

import json
import sys
import time
from typing import Any


def emit(event: str, **fields: Any) -> None:
    row = {"event": event, "ts": int(time.time()), **fields}
    sys.stdout.write(json.dumps(row, default=str) + "\n")
    sys.stdout.flush()
