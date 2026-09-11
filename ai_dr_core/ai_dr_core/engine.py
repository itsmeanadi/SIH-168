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
    motion_state: str = "NORMAL"     # "NORMAL", "HIGH_DYNAMICS", "SHAKE_PROTECTED"
    ai_trust: float = 1.0            # Trust multiplier [0.0, 1.0]


class EngineParameters:
    """Default filter parameters based on KITTI / automotive dead reckoning."""
    def __init__(self):
        self.g = np.array([0.0, 0.0, -9.80655], dtype=np.float64)  # gravity vector (ENU)
        self.P_dim = 21
        self.Q_dim = 18

        # Continuous process noise covariances
        self.cov_omega = 2e-4
        self.cov_acc = 1e-3
        self.cov_b_omega = 1e-5      # Fix 3: smartphone gyro bias drift >> automotive
        self.cov_b_acc = 1e-4        # Fix 2: fast bias tracking for gravity residuals
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
        self.cov_lat = 0.2           # Fix 1: tight lateral constraint for ground vehicle
        self.cov_up = 0.5            # Fix 1: tight vertical constraint for ground vehicle

        # Normalization frequency
        self.n_normalize_rot = 100

        # Fix 4: velocity sanity bounds
        self.max_speed = 69.4        # 250 km/h hard clamp
        self.max_accel = 15.0        # ~1.5g max rate of velocity change

        # Fix 5: adaptive gravity re-alignment
        self.gravity_realign_alpha = 0.01          # EMA blending rate per step

        # Fix 6: engine-level ZUPT (windowed stationary detector)
        self.zupt_gyro_std_tol = 0.05    # rad/s: max gyro per-axis std in window
        self.zupt_acc_horiz_tol = 0.15   # m/s^2: max horizontal acceleration in world frame

        # Fix 7: Shake & Motion Integrity thresholds
        self.shake_acc_std_thresh = 1.2   # m/s^2: per-axis acceleration std threshold
        self.shake_gyro_std_thresh = 0.25  # rad/s: per-axis angular rate std threshold
        self.shake_acc_mag_thresh = 2.0    # m/s^2: total acceleration std magnitude threshold


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
        self._prev_speed: float = 0.0   # Fix 4: for acceleration rate limiting

        # Fix 5/6: Windowed stationary & motion integrity detector buffer
        self._acc_buffer = []     # recent vehicle-frame accel samples
        self._gyro_buffer = []    # recent vehicle-frame gyro samples
        self._stationary_buffer_size = 25  # ~0.5s at 50Hz
        self._is_stationary = False

        # Motion & Sensor Integrity State
        self.motion_state: str = "NORMAL"  # "NORMAL", "HIGH_DYNAMICS", "SHAKE_PROTECTED"
        self.ai_trust: float = 1.0         # Trust multiplier [0.0, 1.0]

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

    def _update_motion_buffer(self, acc: np.ndarray, gyro: np.ndarray):
        """Maintain sliding window buffer for motion statistics."""
        self._acc_buffer.append(acc.copy())
        self._gyro_buffer.append(gyro.copy())
        if len(self._acc_buffer) > self._stationary_buffer_size:
            self._acc_buffer.pop(0)
            self._gyro_buffer.pop(0)

    def _evaluate_motion_integrity(self):
        """
        Fix 7: Motion and Sensor Integrity Evaluation.
        Continuously regulates dynamic AI trust [0.0, 1.0] based on:
        - Handheld isotropic shake / vibration energy
        - Transverse rotational noise vs legitimate yaw
        - Kinematic dynamics and signal consistency
        - Smooth exponential moving average (EMA) temporal filter
        """
        if len(self._acc_buffer) < self._stationary_buffer_size:
            self.motion_state = "NORMAL"
            self.ai_trust = 1.0
            return

        acc_arr = np.array(self._acc_buffer)
        gyro_arr = np.array(self._gyro_buffer)

        acc_std = np.std(acc_arr, axis=0)
        gyro_std = np.std(gyro_arr, axis=0)
        acc_std_mag = float(np.linalg.norm(acc_std))
        gyro_std_mag = float(np.linalg.norm(gyro_std))

        acc_axes_high = int(np.sum(acc_std > self.params.shake_acc_std_thresh))
        gyro_axes_high = int(np.sum(gyro_std > self.params.shake_gyro_std_thresh))
        transverse_gyro_std = float(np.linalg.norm(gyro_std[:2]))

        # Isotropic handheld shake: simultaneous multi-axis acceleration and gyro fluctuations
        is_shake = (
            (acc_axes_high >= 2 or acc_std_mag > self.params.shake_acc_mag_thresh)
            and (gyro_axes_high >= 1 or gyro_std_mag > self.params.shake_gyro_std_thresh or transverse_gyro_std > 0.18)
        )

        if is_shake:
            self.motion_state = "SHAKE_PROTECTED"
            # Scale target trust down smoothly towards 0.0 under sustained shake
            shake_intensity = max(
                (acc_std_mag - self.params.shake_acc_mag_thresh) / max(self.params.shake_acc_mag_thresh, 0.1),
                (transverse_gyro_std - 0.18) / 0.15
            )
            if shake_intensity > 0.8:
                target_trust = 0.0
            else:
                target_trust = float(np.clip(0.35 * (1.0 - shake_intensity), 0.0, 0.35))
            alpha = 0.40  # Rapid protective drop
        else:
            acc_mean = np.mean(acc_arr, axis=0)
            acc_world_mean = self.Rot.dot(acc_mean - self.b_acc) + self.params.g
            horiz_acc_mag = float(np.linalg.norm(acc_world_mean[:2]))
            yaw_rate_mag = float(abs(np.mean(gyro_arr[:, 2])))

            if horiz_acc_mag > 1.5 or yaw_rate_mag > 0.3 or acc_std_mag > 0.8:
                self.motion_state = "HIGH_DYNAMICS"
            else:
                self.motion_state = "NORMAL"

            # Modulate target trust based on transverse gyro disturbance and multi-axis acceleration jitter
            noise_penalty = 0.0
            if transverse_gyro_std > 0.08:
                noise_penalty += (transverse_gyro_std - 0.08) * 1.5
            if acc_axes_high >= 2 and acc_std_mag > 1.2:
                noise_penalty += (acc_std_mag - 1.2) * 0.15

            target_trust = float(np.clip(1.0 - min(0.5, noise_penalty), 0.5, 1.0))
            alpha = 0.12  # Smooth recovery

        # Apply smooth EMA filter
        self.ai_trust = float(np.clip((1.0 - alpha) * self.ai_trust + alpha * target_trust, 0.0, 1.0))
        if target_trust == 0.0 and self.ai_trust < 0.03:
            self.ai_trust = 0.0
        elif target_trust == 1.0 and self.ai_trust > 0.985:
            self.ai_trust = 1.0

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
            if not self._static_tilt_initialized:
                norm_a = float(np.linalg.norm(acc))
                if norm_a > 1.0:  # Guard: skip if adapter returned near-zero vector
                    f_hat = acc / norm_a          # unit vector (body frame)
                    fx, fy, fz = f_hat[0], f_hat[1], f_hat[2]
                    roll_est  = float(np.arctan2(fy, fz))
                    pitch_est = float(np.arctan2(-fx, np.sqrt(fy * fy + fz * fz)))
                    # Preserve existing yaw (0 at cold start, or whatever set_initial_state set)
                    _, _, current_yaw = to_rpy(self.Rot)
                    self.Rot = from_rpy(roll_est, pitch_est, current_yaw)
                self._static_tilt_initialized = True
            self.last_timestamp = t
            self._update_motion_buffer(acc, gyro)
            return self._build_nav_state(t)

        dt = t - self.last_timestamp
        self.last_timestamp = t

        # Bound dt safely against timer pauses or packet delays
        dt = float(np.clip(dt, 0.001, 0.25))

        # Update motion statistics & evaluate motion integrity
        self._update_motion_buffer(acc, gyro)
        self._evaluate_motion_integrity()

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

        # 5. Fix 6: Engine-level stationary detection & ZUPT
        self._zupt_update(acc, gyro)

        # 6. Fix 5: Adaptive gravity re-alignment at low speed
        self._gravity_realign(acc)

        # 7. Fix 4: Velocity magnitude & rate-of-change clamping
        self._clamp_velocity(dt)

        # 8. Periodic Numerical SVD Normalization of Rotation Matrix
        self.step_count += 1
        if self.step_count % self.params.n_normalize_rot == 0:
            self.Rot = normalize_rot(self.Rot)

        return self._build_nav_state(t)

    def _propagate(self, u: np.ndarray, dt: float):
        """Propagate state and covariance over dt via pure strapdown inertial kinematics."""
        omega_unbiased = u[:3] - self.b_omega
        acc_unbiased = u[3:6] - self.b_acc

        # Specific force rotated to world frame + gravity
        acc_world = self.Rot.dot(acc_unbiased) + self.params.g

        # Pure physical kinematics integration
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
        # Scale measurement covariance by AI trust (reject/de-weight update when trust drops)
        scaled_cov = measurement_cov / max(self.ai_trust, 1e-3)
        R = np.diag(np.clip(scaled_cov, 1e-4, 1e4))

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
        I_KH = np.eye(self.params.P_dim) - K.dot(H)
        self.P = I_KH.dot(self.P).dot(I_KH.T) + K.dot(R).dot(K.T)

    def _zupt_update(self, acc: np.ndarray, gyro: np.ndarray):
        """Fix 6: Windowed zero-velocity update with shake protection and stationary latching."""
        if len(self._acc_buffer) < self._stationary_buffer_size:
            self._is_stationary = False
            return

        if self.motion_state == "SHAKE_PROTECTED":
            self._is_stationary = True
            self.v *= 0.70
            return

        gyro_arr = np.array(self._gyro_buffer)
        acc_arr = np.array(self._acc_buffer)

        # Gyro check: quiet rotation
        gyro_std = np.std(gyro_arr, axis=0)
        gyro_ok = bool(np.all(gyro_std < self.params.zupt_gyro_std_tol)) and float(np.linalg.norm(np.mean(gyro_arr, axis=0))) < 0.05

        # Horizontal acceleration in world frame:
        acc_mean = np.mean(acc_arr, axis=0)
        acc_world_mean = self.Rot.dot(acc_mean - self.b_acc) + self.params.g
        horiz_acc_ok = float(np.linalg.norm(acc_world_mean[:2])) < self.params.zupt_acc_horiz_tol

        # When rotation is quiet and horizontal acceleration is low, vehicle/phone is stationary
        self._is_stationary = gyro_ok and horiz_acc_ok

        if self._is_stationary:
            self.v[:] = 0.0

    def _gravity_realign(self, acc: np.ndarray):
        """Fix 5: Adaptive gravity re-alignment at low speed.
        When stationary or at low speed with quiet gyro, slowly blends roll & pitch toward the measured gravity vector
        to eliminate mount drift over time without disturbing yaw."""
        speed = float(np.linalg.norm(self.v))
        if speed > 0.3:
            return

        if len(self._acc_buffer) < self._stationary_buffer_size:
            return

        gyro_arr = np.array(self._gyro_buffer)
        gyro_std = np.std(gyro_arr, axis=0)
        gyro_quiet = bool(np.all(gyro_std < self.params.zupt_gyro_std_tol)) and float(np.linalg.norm(np.mean(gyro_arr, axis=0))) < 0.05
        if not (self._is_stationary or gyro_quiet):
            return

        acc_mean = np.mean(self._acc_buffer, axis=0)
        norm_a = float(np.linalg.norm(acc_mean))
        g_mag = float(np.linalg.norm(self.params.g))

        if norm_a < 1.0 or abs(norm_a - g_mag) > 1.0:
            return

        f_hat = acc_mean / norm_a
        fx, fy, fz = float(f_hat[0]), float(f_hat[1]), float(f_hat[2])
        roll_meas = float(np.arctan2(fy, fz))
        pitch_meas = float(np.arctan2(-fx, np.sqrt(fy * fy + fz * fz)))

        roll_cur, pitch_cur, yaw_cur = to_rpy(self.Rot)
        alpha = self.params.gravity_realign_alpha
        roll_new = roll_cur + alpha * (roll_meas - roll_cur)
        pitch_new = pitch_cur + alpha * (pitch_meas - pitch_cur)

        self.Rot = from_rpy(roll_new, pitch_new, yaw_cur)

    def _clamp_velocity(self, dt: float):
        """Fix 4: Hard velocity magnitude clamp and acceleration rate limiter."""
        speed = float(np.linalg.norm(self.v))

        # Rate-of-change limit: max_accel m/s per second
        max_delta_speed = self.params.max_accel * dt
        if abs(speed - self._prev_speed) > max_delta_speed:
            if speed > 1e-6:
                target_speed = self._prev_speed + np.sign(speed - self._prev_speed) * max_delta_speed
                self.v *= (target_speed / speed)
                speed = target_speed

        # Hard magnitude clamp
        if speed > self.params.max_speed:
            self.v *= (self.params.max_speed / speed)
            speed = self.params.max_speed

        self._prev_speed = speed

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
            uncertainty_p=np.diag(self.P).copy(),
            motion_state=self.motion_state,
            ai_trust=self.ai_trust
        )
