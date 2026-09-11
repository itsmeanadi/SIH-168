# integration/ws_server.py
import asyncio
import json
import unittest
from unittest.mock import MagicMock

try:
    import websockets
except ImportError:
    print("WARNING: 'websockets' module not found. Install with: pip install websockets")

class TelemetryServer:
    def __init__(self, handover_wrapper, host="0.0.0.0", port=8765):
        """
        Minimal WebSocket server to route phone telemetry to the integration layer.
        Does NOT contain navigation logic.
        """
        self.wrapper = handover_wrapper
        self.host = host
        self.port = port
        self.last_imu_timestamp = None

    async def telemetry_handler(self, websocket, path=None):
        """Handles incoming connections and routes messages based on type."""
        print("Phone client connected.")
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")

                    if msg_type == "imu":
                        # Standardize format for the adapter/engine
                        # Note: dt (delta time) is often required by EKF predict steps
                        current_time = data.get("timestamp", 0.0)
                        dt = 0.0
                        if self.last_imu_timestamp is not None:
                            dt = current_time - self.last_imu_timestamp
                        self.last_imu_timestamp = current_time

                        imu_sample = {
                            "timestamp": current_time,
                            "dt": dt,
                            "acc": data.get("accelerometer", [0, 0, 0]),
                            "gyro": data.get("gyroscope", [0, 0, 0])
                        }
                        self.wrapper.process_imu(imu_sample)

                    elif msg_type == "gnss":
                        self.wrapper.process_gnss(
                            timestamp=data.get("timestamp", 0.0),
                            lat=data.get("latitude", 0.0),
                            lon=data.get("longitude", 0.0),
                            speed=data.get("speed", 0.0),
                            heading=data.get("heading", 0.0),
                            accuracy=data.get("accuracy", 0.0)
                        )
                except json.JSONDecodeError:
                    print("Invalid JSON received. Ignoring.")
                    
        except websockets.exceptions.ConnectionClosed:
            print("Phone client disconnected.")

    async def start_server(self):
        """Starts the WebSocket server indefinitely."""
        print(f"Starting Telemetry WebSocket Server on ws://{self.host}:{self.port}")
        async with websockets.serve(self.telemetry_handler, self.host, self.port):
            await asyncio.Future()  # Run forever


# --- Minimal Unit Tests ---

class TestTelemetryServer(unittest.IsolatedAsyncioTestCase):
    async def test_imu_routing(self):
        mock_wrapper = MagicMock()
        server = TelemetryServer(mock_wrapper)
        
        # Mock a WebSocket yielding a single IMU message
        mock_ws = MagicMock()
        valid_imu_json = json.dumps({
            "type": "imu",
            "timestamp": 12345.0,
            "accelerometer": [0, 9.81, 0],
            "gyroscope": [0.1, 0, 0]
        })
        
        # Async generator mock
        async def mock_receive():
            yield valid_imu_json
            
        mock_ws.__aiter__.return_value = mock_receive()
        
        await server.telemetry_handler(mock_ws)
        
        # Verify the wrapper received the correctly structured dict
        mock_wrapper.process_imu.assert_called_once()
        args, _ = mock_wrapper.process_imu.call_args
        self.assertEqual(args[0]["acc"], [0, 9.81, 0])
        self.assertEqual(args[0]["gyro"], [0.1, 0, 0])
        self.assertEqual(args[0]["timestamp"], 12345.0)

    async def test_gnss_routing(self):
        mock_wrapper = MagicMock()
        server = TelemetryServer(mock_wrapper)
        
        mock_ws = MagicMock()
        valid_gnss_json = json.dumps({
            "type": "gnss",
            "timestamp": 12345.0,
            "latitude": 23.25,
            "longitude": 77.41,
            "speed": 8.4,
            "heading": 91.2,
            "accuracy": 3.1
        })
        
        async def mock_receive():
            yield valid_gnss_json
            
        mock_ws.__aiter__.return_value = mock_receive()
        
        await server.telemetry_handler(mock_ws)
        
        mock_wrapper.process_gnss.assert_called_once_with(
            timestamp=12345.0,
            lat=23.25,
            lon=77.41,
            speed=8.4,
            heading=91.2,
            accuracy=3.1
        )

if __name__ == '__main__':
    unittest.main(verbosity=2)