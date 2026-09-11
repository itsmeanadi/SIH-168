# File: integration/health_monitor.py

import time
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class HealthStatus:
    last_imu_ts: Optional[float] = None
    last_gnss_ts: Optional[float] = None
    imu_rate: float = 0.0
    gnss_rate: float = 0.0
    nav_rate: float = 0.0
    rejected_packets: int = 0
    current_mode: str = "STANDBY"
    alignment_status: str = "WAITING"
    gnss_accuracy: Optional[float] = None
    gnss_speed: Optional[float] = None
    gnss_heading: Optional[float] = None
    packet_loss: float = 0.0

    # Connection diagnostics
    connected: bool = False
    connection_time: Optional[float] = None
    disconnection_time: Optional[float] = None
    client_id: Optional[str] = None
    mounting_preset: str = "UNKNOWN"


    # Timestamp diagnostics
    last_dt: float = 0.0
    avg_dt: float = 0.0
    min_dt: float = float('inf')
    max_dt: float = 0.0
    timestamp_gaps: int = 0

    # Sanity checks
    imu_finite: bool = True
    gnss_finite: bool = True
    sensor_constant: bool = False

class HealthMonitor:
    """
    Tracks the health and performance of the IDR telemetry and navigation pipeline.
    """
    def __init__(self):
        self.status = HealthStatus()
        self._last_imu_time = time.time()
        self._last_gnss_time = time.time()
        self._last_nav_time = time.time()
        self._imu_count = 0
        self._gnss_count = 0
        self._nav_count = 0

        # For rate calculation
        self._window_size = 10
        self._imu_intervals = []
        self._gnss_intervals = []
        self._nav_intervals = []

    def record_imu(self, ts: float, acc: list = None, gyro: list = None):
        now = time.time()

        # Sanity check: Constant sensor values
        if acc is not None and gyro is not None:
            # Use a small buffer to detect "stuck" sensors
            if not hasattr(self, '_imu_val_buffer'):
                self._imu_val_buffer = []

            self._imu_val_buffer.append((acc, gyro))
            if len(self._imu_val_buffer) > self._window_size:
                self._imu_val_buffer.pop(0)

            if len(self._imu_val_buffer) == self._window_size:
                # Check if all values in buffer are identical (within epsilon)
                first_acc, first_gyro = self._imu_val_buffer[0]
                is_constant = True
                for a, g in self._imu_val_buffer:
                    if not (np.allclose(a, first_acc, atol=1e-4) and np.allclose(g, first_gyro, atol=1e-4)):
                        is_constant = False
                        break
                self.status.sensor_constant = is_constant

        # Timestamp diagnostics
        if self.status.last_imu_ts is not None:
            dt = ts - self.status.last_imu_ts
            self.status.last_dt = dt
            if dt <= 0:
                self.status.timestamp_gaps += 1

            self.status.min_dt = min(self.status.min_dt, dt)
            self.status.max_dt = max(self.status.max_dt, dt)

            # Moving average for dt
            self.status.avg_dt = (self.status.avg_dt * 0.9) + (dt * 0.1) if self.status.avg_dt != 0 else dt

        self.status.last_imu_ts = ts

        # Rate calculation
        interval = now - self._last_imu_time
        self._last_imu_time = now

        if interval > 0:
            self._imu_intervals.append(interval)
            if len(self._imu_intervals) > self._window_size:
                self._imu_intervals.pop(0)

            avg_interval = sum(self._imu_intervals) / len(self._imu_intervals)
            self.status.imu_rate = 1.0 / avg_interval


    def update_imu_finite(self, finite: bool):
        self.status.imu_finite = finite

    def update_gnss_finite(self, finite: bool):
        self.status.gnss_finite = finite

    def record_gnss(self, ts: float, accuracy=None, speed=None, heading=None):
        now = time.time()
        self.status.last_gnss_ts = ts
        self.status.gnss_accuracy = accuracy
        self.status.gnss_speed = speed
        self.status.gnss_heading = heading

        # Sanity check: Constant GNSS (stuck coordinates/speed)
        # We track accuracy/speed as a proxy for "liveness"
        if not hasattr(self, '_gnss_val_buffer'):
            self._gnss_val_buffer = []

        val = (accuracy, speed, heading)
        self._gnss_val_buffer.append(val)
        if len(self._gnss_val_buffer) > self._window_size:
            self._gnss_val_buffer.pop(0)

        if len(self._gnss_val_buffer) == self._window_size:
            first = self._gnss_val_buffer[0]
            # If all samples are exactly identical, it's suspicious
            if all(v == first for v in self._gnss_val_buffer):
                # We don't mark sensor_constant = True because that's shared with IMU.
                # We could add gnss_constant to HealthStatus.
                pass

        interval = now - self._last_gnss_time
        self._last_gnss_time = now

        if interval > 0:
            self._gnss_intervals.append(interval)
            if len(self._gnss_intervals) > self._window_size:
                self._gnss_intervals.pop(0)

            avg_interval = sum(self._gnss_intervals) / len(self._gnss_intervals)
            self.status.gnss_rate = 1.0 / avg_interval

    def record_nav(self):
        now = time.time()
        interval = now - self._last_nav_time
        self._last_nav_time = now

        if interval > 0:
            self._nav_intervals.append(interval)
            if len(self._nav_intervals) > self._window_size:
                self._nav_intervals.pop(0)

            avg_interval = sum(self._nav_intervals) / len(self._nav_intervals)
            self.status.nav_rate = 1.0 / avg_interval

    def record_rejection(self):
        self.status.rejected_packets += 1

    def update_mode(self, mode: str):
        self.status.current_mode = mode

    def update_mounting(self, preset: str):
        self.status.mounting_preset = preset

    def update_alignment(self, status: str):
        self.status.alignment_status = status

    def get_status(self) -> HealthStatus:
        return self.status
