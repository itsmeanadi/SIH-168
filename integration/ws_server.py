import asyncio
import http
import json
import math
import time
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

            @property
            def motion_state(self):
                return getattr(self.core, "motion_state", "NORMAL")

            @property
            def ai_trust(self):
                return getattr(self.core, "ai_trust", 1.0)
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
from integration.health_monitor import HealthMonitor
from integration.recorder import SessionRecorder

class TelemetryValidator:

    def __init__(self, max_imu_dt: float = 0.2):
        self.max_imu_dt = max_imu_dt
        self.last_imu_ts = None
        self._last_gap_ts = None

    def normalize_timestamp(self, ts: float) -> float:
        if ts > 1e11:
            return ts / 1000.0
        return float(ts)

    def validate_imu(self, msg: dict) -> tuple[bool, str]:
        if not isinstance(msg, dict):
            return False, "Message is not a JSON object"

        raw_ts = msg.get("timestamp")
        if (
            raw_ts is None
            or type(raw_ts) is bool
            or not isinstance(raw_ts, (int, float))
            or not math.isfinite(raw_ts)
            or raw_ts <= 0
        ):
            return False, f"Invalid timestamp: {raw_ts}"

        acc = msg.get("accelerometer")
        if acc is None:
            acc = msg.get("accel") if msg.get("accel") is not None else msg.get("acc")
        if isinstance(acc, dict):
            acc = [
                acc.get("x", acc.get("acc_x", 0.0)),
                acc.get("y", acc.get("acc_y", 0.0)),
                acc.get("z", acc.get("acc_z", 0.0)),
            ]
        elif acc is None and "acc_x" in msg and "acc_y" in msg and "acc_z" in msg:
            acc = [msg["acc_x"], msg["acc_y"], msg["acc_z"]]

        gyro = msg.get("gyroscope")
        if gyro is None:
            gyro = msg.get("gyro")
        if isinstance(gyro, dict):
            gyro = [
                gyro.get("x", gyro.get("gyro_x", 0.0)),
                gyro.get("y", gyro.get("gyro_y", 0.0)),
                gyro.get("z", gyro.get("gyro_z", 0.0)),
            ]
        elif gyro is None and "gyro_x" in msg and "gyro_y" in msg and "gyro_z" in msg:
            gyro = [msg["gyro_x"], msg["gyro_y"], msg["gyro_z"]]

        if not isinstance(acc, (list, tuple)) or len(acc) != 3:
            return False, f"Invalid accelerometer array: {acc}"
        if not isinstance(gyro, (list, tuple)) or len(gyro) != 3:
            return False, f"Invalid gyroscope array: {gyro}"

        if not all(
            type(v) is not bool and isinstance(v, (int, float)) and math.isfinite(v)
            for v in acc + gyro
        ):
            return False, "Non-finite or boolean value in sensor data"

        ts = self.normalize_timestamp(raw_ts)

        if self.last_imu_ts is not None:
            dt = ts - self.last_imu_ts
            if dt <= 0.0:
                return False, f"Timestamp out of order or duplicate: dt={dt:.4f}s"
            if dt > self.max_imu_dt:
                if self._last_gap_ts is not None:
                    gap_dt = ts - self._last_gap_ts
                    if 0.0 < gap_dt <= self.max_imu_dt:
                        self.last_imu_ts = ts
                        self._last_gap_ts = None
                        msg["timestamp"] = ts
                        msg["accelerometer"] = [float(v) for v in acc]
                        msg["gyroscope"] = [float(v) for v in gyro]
                        return True, ""
                self._last_gap_ts = ts
                return False, f"Excessive IMU gap: dt={dt:.4f}s"

        self._last_gap_ts = None
        self.last_imu_ts = ts
        msg["timestamp"] = ts
        msg["accelerometer"] = [float(v) for v in acc]
        msg["gyroscope"] = [float(v) for v in gyro]
        return True, ""

    def validate_gnss(self, msg: dict) -> tuple[bool, str]:
        if not isinstance(msg, dict):
            return False, "Message is not a JSON object"

        raw_ts = msg.get("timestamp")
        if (
            raw_ts is None
            or type(raw_ts) is bool
            or not isinstance(raw_ts, (int, float))
            or not math.isfinite(raw_ts)
            or raw_ts <= 0
        ):
            return False, f"Invalid timestamp: {raw_ts}"

        lat = msg.get("latitude")
        if lat is None:
            lat = msg.get("lat")
        lon = msg.get("longitude")
        if lon is None:
            lon = msg.get("lon") if msg.get("lon") is not None else msg.get("lng")

        if type(lat) is bool or not isinstance(lat, (int, float)) or not math.isfinite(lat):
            return False, f"Invalid latitude: {lat}"
        if type(lon) is bool or not isinstance(lon, (int, float)) or not math.isfinite(lon):
            return False, f"Invalid longitude: {lon}"

        if not (-90 <= lat <= 90):
            return False, f"Latitude out of range: {lat}"
        if not (-180 <= lon <= 180):
            return False, f"Longitude out of range: {lon}"

        msg["latitude"] = float(lat)
        msg["longitude"] = float(lon)

        speed = msg.get("speed")
        if speed is None:
            speed = msg.get("speed_mps")
        if speed is not None:
            if type(speed) is bool or not isinstance(speed, (int, float)) or not math.isfinite(speed):
                return False, f"Invalid speed: {speed}"
            msg["speed"] = float(speed)

        heading = msg.get("heading")
        if heading is None:
            heading = msg.get("heading_deg") if msg.get("heading_deg") is not None else msg.get("bearing")
        if heading is not None:
            if type(heading) is bool or not isinstance(heading, (int, float)) or not math.isfinite(heading):
                return False, f"Invalid heading: {heading}"
            msg["heading"] = float(heading)

        accuracy = msg.get("accuracy")
        if accuracy is None:
            accuracy = msg.get("accuracy_m")
        if accuracy is not None:
            if type(accuracy) is bool or not isinstance(accuracy, (int, float)) or not math.isfinite(accuracy):
                return False, f"Invalid accuracy: {accuracy}"
            msg["accuracy"] = float(accuracy)

        msg["timestamp"] = self.normalize_timestamp(raw_ts)
        return True, ""


class TelemetryServer:

    def __init__(self, handover_wrapper):
        self.health = HealthMonitor()
        self.wrapper = handover_wrapper
        self.wrapper.health = self.health # Inject health monitor into wrapper
        self.validators = {} # Map: websocket -> TelemetryValidator
        self.recorder = SessionRecorder()
        self.connected_clients = set()

    def handle_raw_message(self, raw_data: str, client):
        try:
            msg = json.loads(raw_data)
        except Exception as e:
            # We don't log every malformed JSON to avoid flooding, but we record rejection
            self.health.record_rejection()
            return

        self.on_message(msg, client)

    def on_message(self, msg: dict, client):
        try:
            if not isinstance(msg, dict):
                self.health.record_rejection()
                return

            msg_type = msg.get("type")

            # Handle composite sensor frame (e.g. from Android Web Bridge / PWA / mobile clients)
            if msg_type == "sensor_frame" or ("imu" in msg and isinstance(msg.get("imu"), dict)):
                imu_data = msg.get("imu")
                gnss_data = msg.get("gnss") if msg.get("gnss") is not None else msg.get("gps")

                if imu_data and isinstance(imu_data, dict):
                    if "timestamp" not in imu_data:
                        imu_data["timestamp"] = msg.get("timestamp", time.time())
                    imu_data.setdefault("type", "imu")
                    self.on_message(imu_data, client)

                if gnss_data and isinstance(gnss_data, dict) and (gnss_data.get("latitude") is not None or gnss_data.get("lat") is not None):
                    if "timestamp" not in gnss_data:
                        gnss_data["timestamp"] = msg.get("timestamp", time.time())
                    gnss_data.setdefault("type", "gnss")
                    self.on_message(gnss_data, client)
                return

            # Get or create validator for this specific client session
            validator = self.validators.setdefault(client, TelemetryValidator())

            if msg_type == "imu":
                is_valid, reason = validator.validate_imu(msg)
                # Update finiteness based on validator reason
                self.health.update_imu_finite(not ("Non-finite" in reason))
                if is_valid:
                    self.health.record_imu(msg["timestamp"], msg.get("accelerometer"), msg.get("gyroscope"))
                    self.recorder.record("imu", msg)
                    self.wrapper.process_imu(msg)
                else:
                    self.health.record_rejection()

            elif msg_type == "gnss":
                is_valid, reason = validator.validate_gnss(msg)
                # Update finiteness based on validator reason
                self.health.update_gnss_finite(not ("finite" in reason.lower()))
                if is_valid:
                    self.health.record_gnss(
                        msg["timestamp"],
                        accuracy=msg.get("accuracy"),
                        speed=msg.get("speed"),
                        heading=msg.get("heading")
                    )
                    self.recorder.record("gnss", msg)
                    self.wrapper.handle_gnss(msg)
                else:
                    self.health.record_rejection()

            elif msg_type == "config":
                preset = msg.get("mounting_preset", "UNKNOWN")
                self.health.update_mounting(preset)
                adapter = getattr(self.wrapper.engine, "adapter", None)
                if adapter is None and hasattr(self.wrapper.engine, "core"):
                    adapter = getattr(self.wrapper.engine.core, "adapter", None)

                if adapter is not None:
                    preset_mat = adapter.PRESETS.get(preset.upper())
                    if preset_mat is not None:
                        adapter.R_mount = preset_mat
                print(f"[CONFIG] Mounting preset updated to: {preset}")
            else:
                # Unknown type
                pass
        except Exception as e:
            print(f"[SERVER ERROR] Processing message: {e}")

    async def output_loop(self):
        """Pushes navigation state to clients at 10 Hz."""
        while True:
            start_time = time.time()

            # Get latest state from engine without advancing it
            engine = self.wrapper.engine
            p = engine.p
            v = engine.v

            if p is not None:
                # Convert engine state to Lat/Lon
                lat, lon = self.wrapper.get_current_latlon()

                # Fallback to 0.0 if not yet aligned
                lat = lat if lat is not None else 0.0
                lon = lon if lon is not None else 0.0

                # Construct payload for the mobile app
                nav_mode = getattr(self.wrapper, "mode", "DR")
                is_aligned = getattr(self.wrapper, "is_aligned", False)
                motion_state = getattr(engine, "motion_state", "NORMAL")
                ai_trust = float(getattr(engine, "ai_trust", 1.0))
                is_zupt = getattr(self.wrapper, "is_zupt_active", False)

                # Realistic heading from attitude matrix
                heading_deg = 0.0
                rot_mat = getattr(engine, "Rot", None)
                if rot_mat is None and hasattr(engine, "core"):
                    rot_mat = getattr(engine.core, "Rot", None)

                if rot_mat is not None:
                    try:
                        from ai_dr_core.lie_algebra import to_rpy
                        r, p_ang, y = to_rpy(rot_mat)
                        yaw_offset = getattr(self.wrapper, "gnss_yaw_offset", 0.0)
                        heading_deg = float((np.degrees(y) + np.degrees(yaw_offset)) % 360)
                    except Exception:
                        heading_deg = 0.0

                # Clamped speed to prevent drift when stationary
                raw_speed = float(np.linalg.norm(v) * 3.6) if v is not None else 0.0
                if not is_aligned or is_zupt or raw_speed < 0.6:
                    reported_speed = 0.0
                else:
                    reported_speed = raw_speed

                payload = {
                    "type": "vehicle_position",
                    "lat": lat,
                    "lng": lon,
                    "heading": heading_deg,
                    "speed": reported_speed,
                    "timestamp": time.time(),
                    "nav_mode": nav_mode,
                    "is_aligned": is_aligned,
                    "motion_state": motion_state,
                    "ai_trust": ai_trust,
                    "zupt_active": is_zupt,
                }



                # We don't have a LatLon converter in the server, but the mobile app
                # expects lat/lng. For the demo, we can just send the local X/Y
                # if we modify the mobile app, or implement a basic converter.
                # For now, let's just push the state.

                message = json.dumps(payload)
                for client in list(self.connected_clients):
                    try:
                        await client.send(message)
                    except:
                        self.connected_clients.discard(client)

                self.recorder.record("nav_state", payload)

            self.health.record_nav()

            # Target 10Hz (100ms)
            elapsed = time.time() - start_time
            await asyncio.sleep(max(0, 0.1 - elapsed))

    async def diagnostic_loop(self):
        """Prints system status to console at 1 Hz."""
        while True:
            status = self.health.get_status()
            engine = self.wrapper.engine

            # Clear terminal
            print("\033[H\033[J", end="")

            print("========================================================")
            print(" IDR LIVE STATUS")
            print("========================================================")

            # Connection
            conn_status = "CONNECTED" if status.connected else "DISCONNECTED"
            print(f"Connection : {conn_status}")
            if status.connected:
                print(f"Client     : {status.client_id}")
                print(f"Mounting   : {status.mounting_preset}")
                print(f"Connected  : {time.strftime('%H:%M:%S', time.localtime(status.connection_time)) if status.connection_time else 'N/A'}")
            elif status.disconnection_time:
                print(f"Disconnected at: {time.strftime('%H:%M:%S', time.localtime(status.disconnection_time))}")

            print(f"Session    : {self.recorder.get_session_id()}")
            print("--------------------------------------------------------")

            # IMU
            imu_status = "HEALTHY"
            if status.imu_rate < 20: imu_status = "LOW RATE"
            if not status.imu_finite: imu_status = "NON-FINITE"
            if status.sensor_constant: imu_status = "CONSTANT/STUCK"

            print(f"IMU")
            print(f"Rate       : {status.imu_rate:5.1f} Hz")
            print(f"Status     : {imu_status}")

            # GNSS
            gnss_status = "HEALTHY"
            if status.gnss_rate < 0.5: gnss_status = "LOW RATE"
            if not status.gnss_finite: gnss_status = "NON-FINITE"
            if status.gnss_rate == 0: gnss_status = "NO SIGNAL"

            print(f"\nGNSS")
            print(f"Rate       : {status.gnss_rate:5.1f} Hz")
            print(f"Accuracy   : {status.gnss_accuracy if status.gnss_accuracy else 'N/A'} m")
            print(f"Status     : {gnss_status}")

            # Timestamp
            ts_status = "HEALTHY"
            if status.timestamp_gaps > 0: ts_status = "GAPS DETECTED"
            if status.avg_dt > 0.05: ts_status = "HIGH JITTER"

            print(f"\nTIMESTAMP")
            print(f"dt         : {status.last_dt:5.4f} s")
            print(f"Status     : {ts_status}")

            # Alignment
            print(f"\nALIGNMENT")
            print(f"Status     : {status.alignment_status}")
            if status.alignment_status == "WAITING":
                # We'll need a way to get the "Reason" from the wrapper
                # For now, we just print status
                pass

            # Navigation
            print(f"\nNAVIGATION")
            print(f"Mode       : {status.current_mode}")
            print(f"Rate       : {status.nav_rate:5.1f} Hz")
            print(f"State      : {getattr(engine, 'motion_state', 'NORMAL')}")
            print(f"AI Trust   : {getattr(engine, 'ai_trust', 1.0):5.2f}")

            # Position
            lat, lon = self.wrapper.get_current_latlon()
            print(f"\nPosition")
            print(f"Lat        : {lat:.6f}" if lat else "Lat        : N/A")
            print(f"Lon        : {lon:.6f}" if lon else "Lon        : N/A")

            # Velocity
            v = engine.v
            print(f"\nVelocity")
            print(f"Vx         : {v[0]:5.2f}")
            print(f"Vy         : {v[1]:5.2f}")
            print(f"Speed      : {np.linalg.norm(v)*3.6:5.2f} km/h")

            # ZUPT
            zupt = "ACTIVE" if getattr(self.wrapper, 'is_zupt_active', False) else "INACTIVE"
            print(f"\nZUPT       : {zupt}")

            print("\nPackets")
            print(f"Rejected   : {status.rejected_packets}")
            print("========================================================")
            print("Press Ctrl+C to stop server.")

            await asyncio.sleep(1.0)

async def main():
    engine = AIEKFEngine()
    wrapper = GNSSHandoverWrapper(engine)
    server = TelemetryServer(wrapper)

    async def ws_handler(websocket):
        server.connected_clients.add(websocket)
        try:
            async for message in websocket:
                server.handle_raw_message(message, websocket)
        except Exception:
            pass
        finally:
            server.connected_clients.discard(websocket)
            if websocket in server.validators:
                del server.validators[websocket]

    def process_request(conn, req):
        if req.headers.get("Upgrade", "").lower() != "websocket":
            return conn.respond(
                http.HTTPStatus.OK,
                '{"status": "healthy", "service": "idr-telemetry"}\n',
            )
        return None

    print("Starting IDR Telemetry WebSocket Server on ws://0.0.0.0:8765...")

    # Run server, output loop, and diagnostic loop concurrently
    async with websockets.serve(ws_handler, "0.0.0.0", 8765, process_request=process_request):
        await asyncio.gather(
            server.output_loop(),
            server.diagnostic_loop(),
            asyncio.Future() # Keep main alive
        )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
