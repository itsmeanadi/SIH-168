# File: integration/ws_server.py

import asyncio
import json
import math
from pathlib import Path
import sys

# Resolve project root and ai_dr_core directory paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_DR_CORE_DIR = PROJECT_ROOT / "ai_dr_core"

for path in (AI_DR_CORE_DIR, PROJECT_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import websockets
import numpy as np

try:
    from ai_dr_core.engine import AIEKFEngine
except (ImportError, AttributeError):
    try:
        from ai_dr_core.engine import AIDREngine

        class AIEKFEngine:
            """Adapter wrapping AIDREngine for GNSSHandoverWrapper interface."""

            def __init__(self, core_engine=None):
                self.core = core_engine if core_engine is not None else AIDREngine()

            @property
            def p(self):
                return self.core.p

            @p.setter
            def p(self, val):
                self.core.p = np.asarray(val, dtype=np.float64)

            @property
            def v(self):
                return self.core.v

            @v.setter
            def v(self, val):
                self.core.v = np.asarray(val, dtype=np.float64)

            def predict(self, imu_sample: dict):
                return self.core.update(
                    imu_sample["timestamp"],
                    imu_sample["accelerometer"],
                    imu_sample["gyroscope"],
                )

            def update(self, y, R):
                self.core.v = np.asarray(y, dtype=np.float64)
    except (ImportError, AttributeError):
        class AIEKFEngine:
            def __init__(self):
                self.p = np.zeros(3, dtype=float)
                self.v = np.zeros(3, dtype=float)

            def predict(self, imu_sample):
                pass

            def update(self, y, R):
                self.v = np.asarray(y, dtype=float)

from integration.gnss_handover import GNSSHandoverWrapper


class TelemetryValidator:

    def __init__(self, max_imu_dt: float = 0.2):
        self.max_imu_dt = max_imu_dt
        self.last_imu_ts = None

    def normalize_timestamp(self, ts: float) -> float:
        if ts > 1e11:
            return ts / 1000.0
        return float(ts)

    def validate_imu(self, msg: dict) -> bool:
        if not isinstance(msg, dict):
            return False
        raw_ts = msg.get("timestamp")
        if (
            raw_ts is None
            or type(raw_ts) is bool
            or not isinstance(raw_ts, (int, float))
            or not math.isfinite(raw_ts)
            or raw_ts <= 0
        ):
            return False

        acc = msg.get("accelerometer")
        gyro = msg.get("gyroscope")
        if not isinstance(acc, (list, tuple)) or len(acc) != 3:
            return False
        if not isinstance(gyro, (list, tuple)) or len(gyro) != 3:
            return False
        if not all(
            type(v) is not bool and isinstance(v, (int, float)) and math.isfinite(v)
            for v in acc + gyro
        ):
            return False

        ts = self.normalize_timestamp(raw_ts)

        if self.last_imu_ts is not None:
            dt = ts - self.last_imu_ts
            if dt <= 0.0 or dt > self.max_imu_dt:
                return False

        self.last_imu_ts = ts
        msg["timestamp"] = ts
        return True

    def validate_gnss(self, msg: dict) -> bool:
        if not isinstance(msg, dict):
            return False
        raw_ts = msg.get("timestamp")
        if (
            raw_ts is None
            or type(raw_ts) is bool
            or not isinstance(raw_ts, (int, float))
            or not math.isfinite(raw_ts)
            or raw_ts <= 0
        ):
            return False

        lat = msg.get("latitude")
        lon = msg.get("longitude")
        if type(lat) is bool or not isinstance(lat, (int, float)) or not math.isfinite(lat):
            return False
        if type(lon) is bool or not isinstance(lon, (int, float)) or not math.isfinite(lon):
            return False

        for k in ("speed", "heading", "accuracy"):
            v = msg.get(k)
            if v is not None:
                if type(v) is bool or not isinstance(v, (int, float)) or not math.isfinite(v):
                    return False

        msg["timestamp"] = self.normalize_timestamp(raw_ts)
        return True


class TelemetryServer:

    def __init__(self, handover_wrapper):
        self.wrapper = handover_wrapper
        self.validator = TelemetryValidator()

    def handle_raw_message(self, raw_data: str):
        try:
            msg = json.loads(raw_data)
        except Exception:
            return
        self.on_message(msg)

    def on_message(self, msg: dict):
        try:
            if not isinstance(msg, dict):
                return
            msg_type = msg.get("type")

            if msg_type == "imu":
                if self.validator.validate_imu(msg):
                    self.wrapper.process_imu(msg)

            elif msg_type == "gnss":
                if self.validator.validate_gnss(msg):
                    self.wrapper.handle_gnss(msg)
        except Exception:
            return


async def main():
    engine = AIEKFEngine()
    wrapper = GNSSHandoverWrapper(engine)
    server = TelemetryServer(wrapper)

    async def ws_handler(websocket):
        try:
            async for message in websocket:
                server.handle_raw_message(message)
        except Exception:
            pass

    print("Starting IDR Telemetry WebSocket Server on ws://0.0.0.0:8765...")
    async with websockets.serve(ws_handler, "0.0.0.0", 8765):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())