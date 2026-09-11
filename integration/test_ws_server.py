# File: integration/test_ws_server.py

import pytest
from integration.ws_server import TelemetryValidator, TelemetryServer


class MockWrapper:
    def __init__(self):
        self.imu_count = 0
        self.last_imu = None
        self.last_gnss = None

    def process_imu(self, msg):
        self.imu_count += 1
        self.last_imu = msg

    def handle_gnss(self, msg):
        self.last_gnss = msg


def test_valid_imu_message_reaches_wrapper():
    server = TelemetryServer(MockWrapper())
    raw_imu = '{"type": "imu", "timestamp": 1700000000.0, "accelerometer": [0.0, 0.0, 9.81], "gyroscope": [0.0, 0.0, 0.0]}'
    server.handle_raw_message(raw_imu)
    assert server.wrapper.imu_count == 1
    assert server.wrapper.last_imu["timestamp"] == 1700000000.0


def test_valid_gnss_message_reaches_wrapper():
    server = TelemetryServer(MockWrapper())
    raw_gnss = '{"type": "gnss", "timestamp": 1700000000.0, "latitude": 23.25, "longitude": 77.41, "speed": 5.0, "heading": 90.0, "accuracy": 1.0}'
    server.handle_raw_message(raw_gnss)
    assert server.wrapper.last_gnss["latitude"] == 23.25


def test_malformed_json_safely_rejected():
    server = TelemetryServer(MockWrapper())
    server.handle_raw_message("NOT_VALID_JSON{")
    assert server.wrapper.imu_count == 0


def test_unknown_message_type_ignored():
    server = TelemetryServer(MockWrapper())
    server.handle_raw_message('{"type": "unknown_ping", "timestamp": 1700000000.0}')
    assert server.wrapper.imu_count == 0


def test_malformed_sensor_data_rejected():
    server = TelemetryServer(MockWrapper())
    
    # Incorrect array dimension (2 elements instead of 3)
    bad_acc = '{"type": "imu", "timestamp": 1700000000.0, "accelerometer": [0.0, 0.0], "gyroscope": [0.0, 0.0, 0.0]}'
    server.handle_raw_message(bad_acc)
    assert server.wrapper.imu_count == 0

    # Non-numeric sensor array elements
    non_numeric = '{"type": "imu", "timestamp": 1700000000.0, "accelerometer": ["x", "y", "z"], "gyroscope": [0.0, 0.0, 0.0]}'
    server.handle_raw_message(non_numeric)
    assert server.wrapper.imu_count == 0