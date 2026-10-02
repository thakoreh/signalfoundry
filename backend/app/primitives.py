"""Pure identifiers and UTC timestamps, shared without importing persistence."""
from datetime import datetime, timezone
from uuid import uuid4


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def new_id(prefix: str) -> str:
    return f'{prefix}_{uuid4().hex}'
