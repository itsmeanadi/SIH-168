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
    server.handle_raw_message(raw_imu, "test-client")
    assert server.wrapper.imu_count == 1
    assert server.wrapper.last_imu["timestamp"] == 1700000000.0


def test_valid_gnss_message_reaches_wrapper():
    server = TelemetryServer(MockWrapper())
    raw_gnss = '{"type": "gnss", "timestamp": 1700000000.0, "latitude": 23.25, "longitude": 77.41, "speed": 5.0, "heading": 90.0, "accuracy": 1.0}'
    server.handle_raw_message(raw_gnss, "test-client")
    assert server.wrapper.last_gnss["latitude"] == 23.25


def test_malformed_json_safely_rejected():
    server = TelemetryServer(MockWrapper())
    server.handle_raw_message("NOT_VALID_JSON{", "test-client")
    assert server.wrapper.imu_count == 0


def test_unknown_message_type_ignored():
    server = TelemetryServer(MockWrapper())
    server.handle_raw_message('{"type": "unknown_ping", "timestamp": 1700000000.0}', "test-client")
    assert server.wrapper.imu_count == 0


def test_malformed_sensor_data_rejected():
    server = TelemetryServer(MockWrapper())
    
    # Incorrect array dimension (2 elements instead of 3)
    bad_acc = '{"type": "imu", "timestamp": 1700000000.0, "accelerometer": [0.0, 0.0], "gyroscope": [0.0, 0.0, 0.0]}'
    server.handle_raw_message(bad_acc, "test-client")
    assert server.wrapper.imu_count == 0

    # Non-numeric sensor array elements
    non_numeric = '{"type": "imu", "timestamp": 1700000000.0, "accelerometer": ["x", "y", "z"], "gyroscope": [0.0, 0.0, 0.0]}'
    server.handle_raw_message(non_numeric, "test-client")
    assert server.wrapper.imu_count == 0


def test_non_object_json_safely_rejected():
    server = TelemetryServer(MockWrapper())
    server.handle_raw_message("[1, 2, 3]", "test-client")
    server.handle_raw_message('"string"', "test-client")
    server.handle_raw_message("123", "test-client")
    assert server.wrapper.imu_count == 0
    assert server.wrapper.last_gnss is None


def test_malformed_gnss_data_rejected():
    server = TelemetryServer(MockWrapper())

    # Missing latitude or longitude
    server.handle_raw_message('{"type": "gnss", "timestamp": 1700000000.0, "longitude": 77.41}', "test-client")
    assert server.wrapper.last_gnss is None

    server.handle_raw_message('{"type": "gnss", "timestamp": 1700000000.0, "latitude": 23.25}', "test-client")
    assert server.wrapper.last_gnss is None

    # Non-numeric latitude/longitude
    server.handle_raw_message('{"type": "gnss", "timestamp": 1700000000.0, "latitude": "north", "longitude": 77.41}', "test-client")
    assert server.wrapper.last_gnss is None

    # Non-numeric speed/heading/accuracy
    server.handle_raw_message('{"type": "gnss", "timestamp": 1700000000.0, "latitude": 23.25, "longitude": 77.41, "speed": "fast"}', "test-client")
    assert server.wrapper.last_gnss is None

    # Boolean values rejected
    server.handle_raw_message('{"type": "gnss", "timestamp": 1700000000.0, "latitude": true, "longitude": 77.41}', "test-client")
    assert server.wrapper.last_gnss is None


def test_existing_timestamp_validation_works():
    validator = TelemetryValidator(max_imu_dt=0.2)

    # 1. Millisecond timestamp normalization (> 1e11)
    norm_ts = validator.normalize_timestamp(1700000000000.0)
    assert norm_ts == 1700000000.0

    # 2. Invalid timestamps (<= 0, NaN, Inf, non-numeric)
    bad_ts_msg = {"type": "imu", "timestamp": -1.0, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(bad_ts_msg)[0] is False

    zero_ts_msg = {"type": "imu", "timestamp": 0.0, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(zero_ts_msg)[0] is False

    # 3. Valid initial sample
    s1 = {"type": "imu", "timestamp": 1700000000.0, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(s1)[0] is True

    # 4. Non-monotonic timestamp (dt <= 0) rejected
    s_backwards = {"type": "imu", "timestamp": 1700000000.0, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(s_backwards)[0] is False

    # 5. Timestamp gap exceeding max_imu_dt (dt > 0.2) rejected
    s_too_late = {"type": "imu", "timestamp": 1700000000.5, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(s_too_late)[0] is False

    # 6. Valid subsequent sample (dt = 0.02, 50 Hz)
    s_valid = {"type": "imu", "timestamp": 1700000000.02, "accelerometer": [0, 0, 9.81], "gyroscope": [0, 0, 0]}
    assert validator.validate_imu(s_valid)[0] is True

def test_per_client_validator_isolation():
    """Regression: two clients must not share timestamp state.

    Client A sends one IMU sample establishing last_imu_ts.
    Client B then sends a sample with the *same* timestamp.
    If validators were shared, B would be rejected as non-monotonic.
    With per-client isolation, B's first sample must be accepted.
    """
    server = TelemetryServer(MockWrapper())

    ts_base = 1700000000.0
    imu_template = (
        '{{"type": "imu", "timestamp": {ts}, '
        '"accelerometer": [0.0, 0.0, 9.81], "gyroscope": [0.0, 0.0, 0.0]}'
        '}'
    )

    # Client A sends first packet
    server.handle_raw_message(imu_template.format(ts=ts_base), "client-A")
    assert server.wrapper.imu_count == 1, "Client A first packet must be accepted"

    # Client B sends a packet with the identical timestamp
    # Must be accepted because B has its own fresh validator
    server.handle_raw_message(imu_template.format(ts=ts_base), "client-B")
    assert server.wrapper.imu_count == 2, (
        "Client B first packet must be accepted independently of client A's state"
    )

    # Client A sends a duplicate timestamp -- must be rejected (non-monotonic)
    server.handle_raw_message(imu_template.format(ts=ts_base), "client-A")
    assert server.wrapper.imu_count == 2, (
        "Duplicate timestamp on client A must be rejected"
    )
