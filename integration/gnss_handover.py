# File: integration/gnss_handover.py

import math
import numpy as np
import time

class GNSSHandoverWrapper:

    def __init__(
        self,
        engine,
        gnss_speed_threshold: float = 0.2,
        imu_acc_std_thresh: float = 0.15,
        imu_gyro_std_thresh: float = 0.05,
        zupt_noise_std: float = 0.01,
    ):
        self.engine = engine
        self.mode = "DR"
        self.last_gnss_timestamp = None
        self.latest_gnss_speed = None
        self.health = None # Injected by TelemetryServer

        # ZUPT configuration and buffer
        self.gnss_speed_threshold = gnss_speed_threshold
        self.imu_acc_std_thresh = imu_acc_std_thresh
        self.imu_gyro_std_thresh = imu_gyro_std_thresh
        self.zupt_R = (zupt_noise_std**2) * np.eye(3)
        self.imu_buffer_size = 15
        self.imu_buffer = []
        self.is_zupt_active = False

        # GNSS Frame Alignment state
        self.is_aligned = False
        self.gnss_origin_lat = None
        self.gnss_origin_lon = None
        self.gnss_yaw_offset = 0.0

    def _is_valid_gnss(self, gnss_data: dict) -> bool:
        if not isinstance(gnss_data, dict):
            return False
        required_keys = ("timestamp", "latitude", "longitude")
        if not all(k in gnss_data for k in required_keys):
            return False
        if gnss_data["timestamp"] is None or gnss_data["timestamp"] <= 0:
            return False
        return True

    def _latlon_to_enu(self, lat: float, lon: float, ref_lat: float, ref_lon: float):
        # Local flat-earth ENU approximation
        R_earth = 6378137.0
        d_lat = math.radians(lat - ref_lat)
        d_lon = math.radians(lon - ref_lon)
        d_north = d_lat * R_earth
        d_east = d_lon * R_earth * math.cos(math.radians(ref_lat))
        return d_east, d_north

    def _enu_to_latlon(self, east: float, north: float, ref_lat: float, ref_lon: float):
        # Inverse of _latlon_to_enu
        R_earth = 6378137.0
        lat = ref_lat + math.degrees(north / R_earth)
        lon = ref_lon + math.degrees(east / (R_earth * math.cos(math.radians(ref_lat))))
        return lat, lon

    def get_current_latlon(self):
        """Returns the current estimated Lat/Lon based on engine state."""
        if not self.is_aligned or self.gnss_origin_lat is None:
            return None, None

        # Engine state (local frame)
        x_eng = self.engine.p[0]
        y_eng = self.engine.p[1]
        psi = self.gnss_yaw_offset

        # Rotate Engine frame back to ENU frame
        east = x_eng * math.cos(psi) - y_eng * math.sin(psi)
        north = x_eng * math.sin(psi) + y_eng * math.cos(psi)

        return self._enu_to_latlon(east, north, self.gnss_origin_lat, self.gnss_origin_lon)



    def handle_gnss(self, gnss_data: dict):
        if not self._is_valid_gnss(gnss_data):
            return

        self.last_gnss_timestamp = gnss_data["timestamp"]
        self.latest_gnss_speed = gnss_data.get("speed", 0.0)

        # Mode Transition: DR -> GNSS
        if self.mode == "DR":
            print(f"\n[MODE CHANGE] DR -> GNSS | Recovery at {self.last_gnss_timestamp:.3f}s")
            if self.health:
                self.health.update_mode("GNSS")

        self.mode = "GNSS"

        lat = gnss_data["latitude"]
        lon = gnss_data["longitude"]

        # 1. Establish origin on first valid fix
        if self.gnss_origin_lat is None:
            self.gnss_origin_lat = lat
            self.gnss_origin_lon = lon
            print(f"[GNSS] Origin established: {lat:.6f}, {lon:.6f}")
            return

        # 2. Convert to local ENU relative to origin
        d_east, d_north = self._latlon_to_enu(lat, lon, self.gnss_origin_lat, self.gnss_origin_lon)

        # 3. Dynamic Alignment via Course Over Ground (COG)
        if not self.is_aligned:
            dist = math.hypot(d_east, d_north)
            speed = self.latest_gnss_speed
            print(f"[ALIGNMENT] Waiting... Dist: {dist:.2f}m (req >= 5m), Speed: {speed:.2f}m/s (req >= 3m/s)")

            if dist >= 5.0 and speed >= 3.0:
                self.gnss_yaw_offset = math.atan2(d_north, d_east)
                self.is_aligned = True
                print(f"[ALIGNMENT] SUCCESS! Yaw Offset: {math.degrees(self.gnss_yaw_offset):.2f}°")
                if self.health:
                    self.health.update_alignment("ALIGNED")
            else:
                return  # Do not inject position before alignment is complete

        # 4. Inject aligned position to engine
        if self.is_aligned:
            psi = self.gnss_yaw_offset
            cos_psi = math.cos(psi)
            sin_psi = math.sin(psi)

            # Rotate ENU displacement into engine X/Y frame
            x_eng = d_east * cos_psi + d_north * sin_psi
            y_eng = -d_east * sin_psi + d_north * cos_psi

            self.engine.p[0] = x_eng
            self.engine.p[1] = y_eng

    def mark_gnss_lost(self):
        if self.mode == "GNSS":
            print(f"\n[MODE CHANGE] GNSS -> DR | Timeout at {time.time():.3f}s")
            if self.health:
                self.health.update_mode("DR")

        self.mode = "DR"
        self.latest_gnss_speed = None

    def _check_imu_stationary(self) -> bool:
        if len(self.imu_buffer) < self.imu_buffer_size:
            return False

        accs = [s["accelerometer"] for s in self.imu_buffer]
        gyros = [s["gyroscope"] for s in self.imu_buffer]

        acc_std = np.std(accs, axis=0)
        gyro_std = np.std(gyros, axis=0)

        return bool(
            np.all(acc_std < self.imu_acc_std_thresh)
            and np.all(gyro_std < self.imu_gyro_std_thresh)
        )

    def process_imu(self, imu_sample: dict):
        imu_ts = imu_sample.get("timestamp")
        if imu_ts is None or imu_ts <= 0:
            return

        if self.last_gnss_timestamp is not None and self.mode == "GNSS":
            if (imu_ts - self.last_gnss_timestamp) > 2.0:
                self.mark_gnss_lost()

        self.imu_buffer.append(imu_sample)
        if len(self.imu_buffer) > self.imu_buffer_size:
            self.imu_buffer.pop(0)

        self.is_zupt_active = False
        if self.mode == "GNSS" and self.latest_gnss_speed is not None:
            if self.latest_gnss_speed < self.gnss_speed_threshold:
                if self._check_imu_stationary():
                    self.is_zupt_active = True
                    y_zero = np.zeros(3)
                    self.engine.update(y_zero, self.zupt_R)
                    # We don't print every ZUPT to avoid flooding, but we could
                    # print(f"[ZUPT] Active | Speed: {self.latest_gnss_speed:.2f}")

        self.engine.predict(imu_sample)
