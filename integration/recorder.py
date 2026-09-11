# File: integration/recorder.py

import json
import os
from datetime import datetime
from pathlib import Path

class SessionRecorder:
    """
    Records all incoming telemetry and outgoing navigation states
    to a JSONL file for later analysis and replay.
    """
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # Generate session ID based on timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_id = f"session_{timestamp}"
        self.file_path = self.log_dir / f"{self.session_id}.jsonl"

        print(f"Initialized Session Recorder. Logging to: {self.file_path}")

    def record(self, record_type: str, data: dict):
        """
        Records a data entry.
        record_type: 'imu', 'gnss', 'nav_state', 'event', etc.
        """
        entry = {
            "type": record_type,
            "timestamp": datetime.now().timestamp(),
            "data": data
        }

        with open(self.file_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")

    def get_session_id(self) -> str:
        return self.session_id
