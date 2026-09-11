from dataclasses import dataclass
from typing import Optional, Tuple, Union
import numpy as np

from .lie_algebra import (
    Id3, Id6, IdP,
    skew, so3exp, sen3exp, normalize_rot, from_rpy, to_rpy
)
from .model import AICovarianceAdapter
from .sensor_adapter import BaseSensorAdapter, SmartphoneIMUAdapter, IMUData


@dataclass
class NavState:
    """Current navigation state output by the AI-DR Core."""
    timestamp: float
    position: np.ndarray             # [x, y, z] in meters (relative to origin/anchor)
    velocity: np.ndarray             # [vx, vy, vz] in m/s (world frame)
    speed: float                     # scalar speed in m/s
    speed_kmh: float                 # scalar speed in km/h
    orientation_euler: Tuple[float, float, float]  # (roll, pitch, yaw) in degrees
    rotation_matrix: np.ndarray      # 3x3 orientation matrix (body to world)
    gyro_bias: np.ndarray            # [b_wx, b_wy, b_wz] in rad/s
    accel_bias: np.ndarray           # [b_ax, b_ay, b_az] in m/s^2
    cov_measurement: np.ndarray      # [cov_lat, cov_up] predicted by AI
    uncertainty_p: np.ndarray        # 21-dim diagonal of covariance P


class EngineParameters:
    """Default filter parameters based on KITTI / automotive dead reckoning."""
    def __init__(self):
        self.g = np.array([0.0, 0.0, -9.80655], dtype=np.float64)  # gravity vector (ENU)
        self.P_dim = 21
        self.Q_dim = 18

        # Continuous process noise covariances
        self.cov_omega = 2e-4
        self.cov_acc = 1e-3
        self.cov_b_omega = 1e-8
        self.cov_b_acc = 1e-6
        self.cov_Rot_c_i = 1e-8
        self.cov_t_c_i = 1e-8

        # Default initial state uncertainties
        self.cov_Rot0 = 1e-4
        self.cov_v0 = 1e-1
        self.cov_b_omega0 = 1e-4
        self.cov_b_acc0 = 1e-3
        self.cov_Rot_c_i0 = 1e-5
        self.cov_t_c_i0 = 1e-2

        # Default base NHC measurement noise
        self.cov_lat = 1.0
        self.cov_up = 10.0

        # Normalization frequency
        self.n_normalize_rot = 100


class AIDREngine:
    """
    Unified AI-ML Intelligent Dead Reckoning Core.
    Fuses 6-DoF IMU measurements with dynamic Non-Holonomic Constraints (NHC)
    adapted in real time by an AI covariance network (MesNet).
    """

    def __init__(self,
                 adapter: Optional[BaseSensorAdapter] = None,
                 weights_path: Optional[str] = None,
                 use_ai: bool = True,
                 params: Optional[EngineParameters] = None):
        self.adapter = adapter if adapter is not None else SmartphoneIMUAdapter()
        self.params = params if params is not None else EngineParameters()
        self.use_ai = use_ai

        # AI Covariance Adapter
        base_cov = (self.params.cov_lat, self.params.cov_up)
        self.ai_adapter = AICovarianceAdapter(weights_path=weights_path, base_cov=base_cov)

        # Process noise covariance matrix Q (18x18)
        self.Q = np.diag([
            self.params.cov_omega, self.params.cov_omega, self.params.cov_omega,
            self.params.cov_acc, self.params.cov_acc, self.params.cov_acc,
            self.params.cov_b_omega, self.params.cov_b_omega, self.params.cov_b_omega,
            self.params.cov_b_acc, self.params.cov_b_acc, self.params.cov_b_acc,
            self.params.cov_Rot_c_i, self.params.cov_Rot_c_i, self.params.cov_Rot_c_i,
            self.params.cov_t_c_i, self.params.cov_t_c_i, self.params.cov_t_c_i
        ]).astype(np.float64)

        # Internal Filter States
        self.Rot = np.eye(3, dtype=np.float64)           # Orientation
        self.v = np.zeros(3, dtype=np.float64)           # Velocity
        self.p = np.zeros(3, dtype=np.float64)           # Position
        self.b_omega = np.zeros(3, dtype=np.float64)     # Gyro bias
        self.b_acc = np.zeros(3, dtype=np.float64)       # Accel bias
        self.Rot_c_i = np.eye(3, dtype=np.float64)       # Vehicle to IMU orientation
        self.t_c_i = np.zeros(3, dtype=np.float64)       # Vehicle to IMU lever-arm

        # State Covariance P (21x21)
        self.P = np.zeros((self.params.P_dim, self.params.P_dim), dtype=np.float64)
        self._init_covariance()

        # Timing & Iteration tracking
        self.last_timestamp: Optional[float] = None
        self.step_count = 0
        self.latest_measurement_cov = np.array([self.params.cov_lat, self.params.cov_up], dtype=np.float64)

        # Static tilt flag: Rot is initialized to identity; on the very first IMU
        # sample we compute roll/pitch from the measured gravity vector so that
        # acc_world = Rot * f_b + g_world ≈ 0 while the vehicle is stationary.
        # Yaw is left at zero and is NOT estimated from gravity.
        self._static_tilt_initialized: bool = False

    def _init_covariance(self):
        """Initialize covariance matrix P."""
        self.P[:2, :2] = self.params.cov_Rot0 * np.eye(2)
        self.P[3:5, 3:5] = self.params.cov_v0 * np.eye(2)
        self.P[9:12, 9:12] = self.params.cov_b_omega0 * Id3
        self.P[12:15, 12:15] = self.params.cov_b_acc0 * Id3
        self.P[15:18, 15:18] = self.params.cov_Rot_c_i0 * Id3
        self.P[18:21, 18:21] = self.params.cov_t_c_i0 * Id3

    def set_initial_state(self,
                          position: Optional[np.ndarray] = None,
                          velocity: Optional[np.ndarray] = None,
                          roll_pitch_yaw_deg: Optional[Tuple[float, float, float]] = None):
        """Set or reset initial navigation state."""
        if position is not None:
            self.p = np.array(position, dtype=np.float64)
        if velocity is not None:
            self.v = np.array(velocity, dtype=np.float64)
        if roll_pitch_yaw_deg is not None:
            r = np.radians(roll_pitch_yaw_deg[0])
            p = np.radians(roll_pitch_yaw_deg[1])
            y = np.radians(roll_pitch_yaw_deg[2])
            self.Rot = from_rpy(r, p, y)

    def update(self,
               timestamp: float,
               accelerometer: Union[list, np.ndarray],
               gyroscope: Union[list, np.ndarray]) -> NavState:
        """
        Primary single-step update:
        state = engine.update(timestamp, accelerometer, gyroscope)

        timestamp: time in seconds or ms
        accelerometer: [ax, ay, az] in m/s^2 or g
        gyroscope: [wx, wy, wz] in rad/s or deg/s
        Returns: NavState containing full 3D position, velocity, orientation, biases.
        """
        # 1. Standardize sensor inputs through adapter
        imu_data: IMUData = self.adapter.process(timestamp, accelerometer, gyroscope)
        t = imu_data.timestamp
        acc = imu_data.accel
        gyro = imu_data.gyro

        # First sample initialization
        if self.last_timestamp is None:
            # Static gravity alignment: estimate roll & pitch from the first
            # accelerometer reading so that gravity cancels in _propagate.
            # Convention (ZYX, body-to-world, Rot = Rz(yaw)*Ry(pitch)*Rx(roll)):
            #   At rest:  Rot * f_b + g_world = 0
            #             => Rot * f_b = [0, 0, +9.80655]   (world-up)
            #             => f_b / |f_b| = Rot^T * [0,0,1]
            # Extracting roll/pitch with yaw fixed at current yaw (0 at init):
            #   pitch = atan2( fx,  sqrt(fy^2 + fz^2) )
            #   roll  = atan2(-fy,  fz )
            # where [fx, fy, fz] = f_b normalised.
            # Yaw is NOT touched; it is determined solely by GNSS frame alignment.
            if not self._static_tilt_initialized:
                norm_a = float(np.linalg.norm(acc))
                if norm_a > 1.0:  # Guard: skip if adapter returned near-zero vector
                    f_hat = acc / norm_a          # unit vector (body frame)
                    fx, fy, fz = f_hat[0], f_hat[1], f_hat[2]
                    roll_est  = float(np.arctan2(-fy, fz))
                    pitch_est = float(np.arctan2(fx, np.sqrt(fy * fy + fz * fz)))
                    # Preserve existing yaw (0 at cold start, or whatever set_initial_state set)
                    _, _, current_yaw = to_rpy(self.Rot)
                    self.Rot = from_rpy(roll_est, pitch_est, current_yaw)
                self._static_tilt_initialized = True
            self.last_timestamp = t
            return self._build_nav_state(t)

        dt = t - self.last_timestamp
        self.last_timestamp = t

        # Bound dt safely against timer pauses or packet delays
        dt = float(np.clip(dt, 0.001, 0.25))

        # 6D IMU vector [wx, wy, wz, ax, ay, az]
        u = np.concatenate([gyro, acc], axis=0)

        # 2. Dynamic AI Covariance Estimation
        if self.use_ai:
            self.latest_measurement_cov = self.ai_adapter.update_sample(u)
        else:
            self.latest_measurement_cov = np.array([self.params.cov_lat, self.params.cov_up], dtype=np.float64)

        # 3. IEKF State & Covariance Propagation
        self._propagate(u, dt)

        # 4. Non-Holonomic Constraint (NHC) Measurement Update
        self._update_nhc(u, self.latest_measurement_cov)

        # 5. Periodic Numerical SVD Normalization of Rotation Matrix
        self.step_count += 1
        if self.step_count % self.params.n_normalize_rot == 0:
            self.Rot = normalize_rot(self.Rot)

        return self._build_nav_state(t)

    def _propagate(self, u: np.ndarray, dt: float):
        """Propagate state and covariance over dt."""
        omega_unbiased = u[:3] - self.b_omega
        acc_unbiased = u[3:6] - self.b_acc

        # Specific force rotated to world frame + gravity
        acc_world = self.Rot.dot(acc_unbiased) + self.params.g

        # Kinematics integration
        self.p += self.v * dt + 0.5 * acc_world * (dt ** 2)
        self.v += acc_world * dt
        self.Rot = self.Rot.dot(so3exp(omega_unbiased * dt))

        # Covariance propagation on SE_2(3)
        F = np.zeros((self.params.P_dim, self.params.P_dim), dtype=np.float64)
        G = np.zeros((self.params.P_dim, self.params.Q_dim), dtype=np.float64)

        v_skew_rot = skew(self.v).dot(self.Rot)
        p_skew_rot = skew(self.p).dot(self.Rot)

        F[3:6, :3] = skew(self.params.g)
        F[6:9, 3:6] = Id3
        F[3:6, 12:15] = -self.Rot
        F[:3, 9:12] = -self.Rot
        F[3:6, 9:12] = -v_skew_rot
        F[6:9, 9:12] = -p_skew_rot

        G[:3, :3] = self.Rot
        G[3:6, :3] = v_skew_rot
        G[6:9, :3] = p_skew_rot
        G[3:6, 3:6] = self.Rot
        G[9:15, 6:12] = Id6
        G[15:18, 12:15] = Id3
        G[18:21, 15:18] = Id3

        F_dt = F * dt
        G_dt = G * dt
        F_sq = F_dt.dot(F_dt)
        Phi = IdP + F_dt + 0.5 * F_sq + (1.0 / 6.0) * F_sq.dot(F_dt)

        self.P = Phi.dot(self.P + G_dt.dot(self.Q).dot(G_dt.T)).dot(Phi.T)

    def _update_nhc(self, u: np.ndarray, measurement_cov: np.ndarray):
        """Perform Non-Holonomic Constraint (zero lateral/vertical velocity) update."""
        Rot_body = self.Rot.dot(self.Rot_c_i)
        v_imu = self.Rot.T.dot(self.v)
        v_body = self.Rot_c_i.T.dot(v_imu) + skew(self.t_c_i).dot(u[:3] - self.b_omega)
        Omega = skew(u[:3] - self.b_omega)

        H_v_imu = self.Rot_c_i.T.dot(skew(v_imu))
        H_t_c_i = -skew(self.t_c_i)

        H = np.zeros((2, self.params.P_dim), dtype=np.float64)
        H[:, 3:6] = Rot_body.T[1:]
        H[:, 15:18] = H_v_imu[1:]
        H[:, 9:12] = H_t_c_i[1:]
        H[:, 18:21] = -Omega[1:]

        # Innovation: residual = - (v_lateral, v_vertical)
        r = -v_body[1:]
        R = np.diag(np.clip(measurement_cov, 1e-4, 1e4))

        # Innovation covariance S and Kalman Gain K
        S = H.dot(self.P).dot(H.T) + R
        try:
            K = np.linalg.solve(S, self.P.dot(H.T).T).T
        except np.linalg.LinAlgError:
            K = self.P.dot(H.T).dot(np.linalg.pinv(S))

        dx = K.dot(r)

        # Invariant group state update
        dR, dxi = sen3exp(dx[:9])
        dv = dxi[:, 0]
        dp = dxi[:, 1]

        self.Rot = dR.dot(self.Rot)
        self.v = dR.dot(self.v) + dv
        self.p = dR.dot(self.p) + dp

        self.b_omega += dx[9:12]
        self.b_acc += dx[12:15]

        dR_c = so3exp(dx[15:18])
        self.Rot_c_i = dR_c.dot(self.Rot_c_i)
        self.t_c_i += dx[18:21]

        # Joseph form covariance update for numerical stability
        I_KH = IdP - K.dot(H)
        self.P = I_KH.dot(self.P).dot(I_KH.T) + K.dot(R).dot(K.T)

    def _build_nav_state(self, timestamp: float) -> NavState:
        """Construct the NavState summary object."""
        r, p, y = to_rpy(self.Rot)
        speed = float(np.linalg.norm(self.v))
        return NavState(
            timestamp=timestamp,
            position=self.p.copy(),
            velocity=self.v.copy(),
            speed=speed,
            speed_kmh=speed * 3.6,
            orientation_euler=(float(np.degrees(r)), float(np.degrees(p)), float(np.degrees(y))),
            rotation_matrix=self.Rot.copy(),
            gyro_bias=self.b_omega.copy(),
            accel_bias=self.b_acc.copy(),
            cov_measurement=self.latest_measurement_cov.copy(),
            uncertainty_p=np.diag(self.P).copy()
        )
