"""
AI-IMU Dead Reckoning Core
Standardized streaming inertial navigation module based on Invariant EKF on SE_2(3)
and dynamic neural network covariance adaptation (MesNet).
"""

from .engine import AIDREngine, NavState, EngineParameters
from .sensor_adapter import SmartphoneIMUAdapter, BaseSensorAdapter, IMUData
from .model import MesNet, AICovarianceAdapter
from .lie_algebra import so3exp, sen3exp, skew, from_rpy, to_rpy, normalize_rot

__all__ = [
    "AIDREngine",
    "NavState",
    "EngineParameters",
    "SmartphoneIMUAdapter",
    "BaseSensorAdapter",
    "IMUData",
    "MesNet",
    "AICovarianceAdapter",
    "so3exp",
    "sen3exp",
    "skew",
    "from_rpy",
    "to_rpy",
    "normalize_rot",
]
