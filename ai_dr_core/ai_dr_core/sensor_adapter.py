from dataclasses import dataclass
from typing import Optional, Union
import numpy as np

# ==============================================================================
# Sensor Input Abstraction & Smartphone Compatibility Layer
# ==============================================================================

@dataclass
class IMUData:
    timestamp: float        # Timestamp in seconds
    accel: np.ndarray       # 3D acceleration [ax, ay, az] in m/s^2 (vehicle frame)
    gyro: np.ndarray        # 3D angular rate [wx, wy, wz] in rad/s (vehicle frame)
    raw_accel: Optional[np.ndarray] = None
    raw_gyro: Optional[np.ndarray] = None


class BaseSensorAdapter:
    """Base interface for all IMU sensor adapters."""
    def process(self,
                timestamp: float,
                accel: Union[list, np.ndarray],
                gyro: Union[list, np.ndarray]) -> IMUData:
        raise NotImplementedError


class SmartphoneIMUAdapter(BaseSensorAdapter):
    """
    Standardized smartphone IMU adapter.
    Converts raw phone sensor values (from Android / iOS / React Native Expo)
    into the vehicle frame [Forward, Left, Up] expected by the AI-DR core.
    """

    # Common mounting orientation presets
    PRESETS = {
        # Vehicle Forward = +X, Left = +Y, Up = +Z (default identity)
        "IDENTITY": np.eye(3),

        # Phone mounted vertically in a dashboard cradle facing the driver:
        # Phone +Y is Up -> Vehicle Up = Phone +Y
        # Phone +Z is towards driver -> Vehicle Forward = Phone -Z
        # Phone +X is to passenger -> Vehicle Left = Phone -X
        "PORTRAIT_DASHBOARD": np.array([
            [0.0, 0.0, -1.0],   # Vehicle Forward = -Z_phone
            [-1.0, 0.0, 0.0],   # Vehicle Left    = -X_phone
            [0.0, 1.0, 0.0],    # Vehicle Up      = +Y_phone
        ], dtype=np.float64),

        # Phone lying flat on the center console with screen facing up and top facing forward:
        # Phone +Y is pointing forward -> Vehicle Forward = Phone +Y
        # Phone +X is pointing right -> Vehicle Left = Phone -X
        # Phone +Z is pointing up -> Vehicle Up = Phone +Z
        "FLAT_CONSOLE": np.array([
            [0.0, 1.0, 0.0],    # Vehicle Forward = +Y_phone
            [-1.0, 0.0, 0.0],   # Vehicle Left    = -X_phone
            [0.0, 0.0, 1.0],    # Vehicle Up      = +Z_phone
        ], dtype=np.float64),

        # Landscape mount (phone rotated 90 deg counter-clockwise, top facing left):
        "LANDSCAPE_DASHBOARD": np.array([
            [0.0, 0.0, -1.0],   # Vehicle Forward = -Z_phone
            [0.0, 1.0, 0.0],    # Vehicle Left    = +Y_phone
            [1.0, 0.0, 0.0],    # Vehicle Up      = +X_phone
        ], dtype=np.float64),
    }

    def __init__(self,
                 mounting_preset: str = "PORTRAIT_DASHBOARD",
                 custom_rotation_matrix: Optional[np.ndarray] = None,
                 auto_detect_accel_units: bool = True,
                 accel_in_g: bool = False,
                 gyro_in_deg: bool = False):
        """
        mounting_preset: "PORTRAIT_DASHBOARD", "FLAT_CONSOLE", "IDENTITY", etc.
        custom_rotation_matrix: Optional 3x3 rotation matrix R_mount mapping phone -> vehicle frame.
        auto_detect_accel_units: If true, automatically detects whether accel is in g (~1.0) or m/s^2 (~9.8).
        """
        if custom_rotation_matrix is not None:
            self.R_mount = np.array(custom_rotation_matrix, dtype=np.float64)
        else:
            self.R_mount = self.PRESETS.get(mounting_preset.upper(), np.eye(3, dtype=np.float64))

        self.auto_detect_accel_units = auto_detect_accel_units
        self.accel_in_g = accel_in_g
        self.gyro_in_deg = gyro_in_deg

        self.last_timestamp = None
        self._accel_scale = 9.80665 if accel_in_g else 1.0
        self._checked_units = not auto_detect_accel_units

    def process(self,
                timestamp: float,
                accel: Union[list, np.ndarray],
                gyro: Union[list, np.ndarray]) -> IMUData:
        """
        Convert raw smartphone readings into standardized vehicle-frame IMUData.
        timestamp: seconds or milliseconds (auto-detected)
        accel: [ax, ay, az]
        gyro: [wx, wy, wz]
        """
        # 1. Normalize timestamp to seconds
        t = float(timestamp)
        if t > 1e11:  # Milliseconds from epoch (e.g. 1700000000000)
            t /= 1000.0

        raw_a = np.array(accel, dtype=np.float64)
        raw_w = np.array(gyro, dtype=np.float64)

        # 2. Auto-detect accelerometer units (g vs m/s^2)
        if not self._checked_units:
            norm_a = np.linalg.norm(raw_a)
            # If norm is close to 1.0 (typically 0.7 - 1.5), values are in g's
            if 0.5 < norm_a < 2.5:
                self._accel_scale = 9.80665
            else:
                self._accel_scale = 1.0
            self._checked_units = True

        a_metric = raw_a * self._accel_scale

        # 3. Gyroscope units (convert deg/s to rad/s if needed)
        w_metric = raw_w * (np.pi / 180.0) if self.gyro_in_deg else raw_w

        # 4. Transform from smartphone coordinate frame to vehicle coordinate frame:
        # a_vehicle = R_mount * a_phone
        # w_vehicle = R_mount * w_phone
        a_veh = self.R_mount.dot(a_metric)
        w_veh = self.R_mount.dot(w_metric)

        return IMUData(
            timestamp=t,
            accel=a_veh,
            gyro=w_veh,
            raw_accel=raw_a,
            raw_gyro=raw_w
        )
