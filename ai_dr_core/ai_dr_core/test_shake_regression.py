# File: ai_dr_core/ai_dr_core/test_shake_regression.py
"""
Focused regression tests covering the 12 required navigation and integrity scenarios:
1. stationary
2. 5 m synthetic movement
3. 10 m synthetic movement
4. 90° rotation
5. 180° rotation
6. 360° rotation
7. tilt stability
8. gentle shake
9. hard shake
10. stop after motion
11. GNSS blackout
12. GNSS recovery
"""

import sys
import os
import math
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from ai_dr_core.engine import AIDREngine, EngineParameters
from ai_dr_core.sensor_adapter import SmartphoneIMUAdapter
from ai_dr_core.lie_algebra import to_rpy
from integration.gnss_handover import GNSSHandoverWrapper


# ── TEST 1: STATIONARY ────────────────────────────────────────────────────────
class Test1_Stationary:
    def test_stationary_quiet_response(self):
        """Stationary phone: speed stays < 0.05 m/s, trust=1.0, state=NORMAL."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        for _ in range(250):  # 5 seconds
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        assert state.speed < 0.05, f"Expected speed < 0.05 m/s, got {state.speed}"
        assert state.motion_state == "NORMAL", f"Expected NORMAL, got {state.motion_state}"
        assert state.ai_trust == 1.0, f"Expected trust 1.0, got {state.ai_trust}"
        assert np.linalg.norm(state.position) < 0.05, f"Drift too large: {state.position}"


# ── TEST 2: 5M MOVEMENT ───────────────────────────────────────────────────────
class Test2_Movement5m:
    def test_movement_5m_response(self):
        """5m movement: forward accel 1.0 m/s^2 for 3.16s then cruise. Displacement ~5m."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s initial quiet
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # Accel forward: in portrait, vehicle fwd = -Z phone => phone accel az = -1.0
        accel_duration = 3.16  # s -> dist = 0.5 * 1.0 * 3.16^2 ≈ 5.0m
        accel_steps = int(accel_duration / dt)
        for _ in range(accel_steps):
            t += dt
            state = engine.update(t, [0.0, 9.80665, -1.0], [0.0, 0.0, 0.0])

        dist = np.linalg.norm(engine.p[:2])
        assert 3.5 <= dist <= 6.5, f"Expected ~5m displacement, got {dist:.2f}m"
        assert state.ai_trust == 1.0, f"AI trust must not be suppressed during legitimate motion, got {state.ai_trust}"
        assert state.motion_state != "SHAKE_PROTECTED", "Legitimate motion must not be classified as shake"


# ── TEST 3: 10M MOVEMENT ──────────────────────────────────────────────────────
class Test3_Movement10m:
    def test_movement_10m_response(self):
        """10m movement: forward accel 1.0 m/s^2 for 4.47s. Displacement ~10m."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s initial quiet
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        accel_duration = 4.47  # s -> dist = 0.5 * 1.0 * 4.47^2 ≈ 10.0m
        accel_steps = int(accel_duration / dt)
        for _ in range(accel_steps):
            t += dt
            state = engine.update(t, [0.0, 9.80665, -1.0], [0.0, 0.0, 0.0])

        dist = np.linalg.norm(engine.p[:2])
        assert 7.5 <= dist <= 12.5, f"Expected ~10m displacement, got {dist:.2f}m"
        assert state.ai_trust == 1.0, f"AI trust must remain 1.0, got {state.ai_trust}"
        assert state.motion_state != "SHAKE_PROTECTED"


# ── TEST 4: 90° ROTATION ─────────────────────────────────────────────────────
class Test4_Rotation90:
    def test_rotation_90deg_stability(self):
        """90° yaw turn at 30°/s for 3s. Final yaw ~90°, trust=1.0."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # Init
        engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # Yaw rate: in portrait, Vehicle Up = +Y phone => phone gyro wy = +30 deg/s = +0.5236 rad/s
        w_yaw = np.radians(30.0)
        steps = int(3.0 / dt)  # 3s * 30 deg/s = 90 deg
        for _ in range(steps):
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, w_yaw, 0.0])

        _, _, yaw_rad = to_rpy(engine.Rot)
        yaw_deg = math.degrees(yaw_rad)
        assert abs(yaw_deg - 90.0) < 5.0, f"Expected yaw ~90°, got {yaw_deg:.2f}°"
        assert state.ai_trust == 1.0, "AI trust must remain 1.0 during rotation"
        assert state.motion_state != "SHAKE_PROTECTED"


# ── TEST 5: 180° ROTATION ────────────────────────────────────────────────────
class Test5_Rotation180:
    def test_rotation_180deg_stability(self):
        """180° yaw turn at 30°/s for 6s. Final yaw ~180°, trust=1.0."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])
        w_yaw = np.radians(30.0)
        steps = int(6.0 / dt)
        for _ in range(steps):
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, w_yaw, 0.0])

        _, _, yaw_rad = to_rpy(engine.Rot)
        yaw_deg = abs(math.degrees(yaw_rad))
        assert abs(yaw_deg - 180.0) < 6.0, f"Expected yaw ~180°, got {yaw_deg:.2f}°"
        assert state.ai_trust == 1.0
        assert state.motion_state != "SHAKE_PROTECTED"


# ── TEST 6: 360° ROTATION ────────────────────────────────────────────────────
class Test6_Rotation360:
    def test_rotation_360deg_loop(self):
        """360° yaw turn at 30°/s for 12s. Final yaw returns to initial ~0°, trust=1.0."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])
        w_yaw = np.radians(30.0)
        steps = int(12.0 / dt)
        for _ in range(steps):
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, w_yaw, 0.0])

        _, _, yaw_rad = to_rpy(engine.Rot)
        yaw_deg = math.degrees(yaw_rad)
        assert abs(yaw_deg) < 8.0, f"Expected yaw near 0° after 360° loop, got {yaw_deg:.2f}°"
        assert state.ai_trust == 1.0
        assert state.motion_state != "SHAKE_PROTECTED"


# ── TEST 7: TILT STABILITY ───────────────────────────────────────────────────
class Test7_TiltStability:
    @pytest.mark.parametrize("tilt_deg", [15, 30])
    def test_tilt_gravity_stability(self, tilt_deg):
        """Phone tilted by 15°/30°: static alignment cancels gravity, speed stays < 0.2 m/s."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        tilt_rad = math.radians(tilt_deg)
        ay = 9.80665 * math.cos(tilt_rad)
        az = -9.80665 * math.sin(tilt_rad)

        for _ in range(250):  # 5s
            t += dt
            state = engine.update(t, [0.0, ay, az], [0.0, 0.0, 0.0])

        assert state.speed < 0.2, f"Tilt {tilt_deg}°: speed should stay < 0.2 m/s, got {state.speed}"
        assert state.ai_trust == 1.0
        assert state.motion_state != "SHAKE_PROTECTED"


# ── TEST 8: GENTLE SHAKE ─────────────────────────────────────────────────────
class Test8_GentleShake:
    def test_gentle_shake_suppression(self):
        """Gentle handheld vibration: detected as SHAKE_PROTECTED, speed stays < 0.2 m/s."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s quiet
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # 2s gentle shake (2 m/s^2 accel, 0.6 rad/s gyro at 6 Hz)
        speeds = []
        for i in range(100):
            t += dt
            phi = 2 * np.pi * 6.0 * (i * dt)
            ax = 2.0 * np.sin(phi)
            ay = 9.80665 + 2.0 * np.cos(phi)
            az = 2.0 * np.sin(phi + 1.0)
            wx = 0.6 * np.cos(phi)
            wy = 0.6 * np.sin(phi)
            wz = 0.6 * np.cos(phi + 0.5)
            state = engine.update(t, [ax, ay, az], [wx, wy, wz])
            speeds.append(state.speed)

        assert max(speeds) < 0.2, f"Gentle shake peak speed was {max(speeds):.4f} m/s, expected < 0.2"
        assert state.motion_state == "SHAKE_PROTECTED"
        assert state.ai_trust == 0.0
        assert np.linalg.norm(engine.p) < 0.1, f"Displacement exceeded 0.1m: {np.linalg.norm(engine.p)}"


# ── TEST 9: HARD SHAKE ───────────────────────────────────────────────────────
class Test9_HardShake:
    def test_hard_shake_rejection_and_recovery(self):
        """Hard handheld shake: AI speed suppressed, EKF bounded (< 0.5 m/s vs 8.25 m/s baseline), displacement bounded, recovery < 0.5s."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s quiet
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # 2s hard shake (12-15 m/s^2, 2.5-3.0 rad/s at 8 Hz)
        speeds = []
        np.random.seed(42)
        for i in range(100):
            t += dt
            w_vib = 2 * np.pi * 8.0 * (i * dt)
            ax = 12.0 * np.sin(w_vib) + np.random.normal(0, 1.5)
            ay = 9.80665 + 12.0 * np.cos(w_vib) + np.random.normal(0, 1.5)
            az = 12.0 * np.sin(w_vib * 1.2) + np.random.normal(0, 1.5)
            wx = 2.5 * np.cos(w_vib) + np.random.normal(0, 0.3)
            wy = 2.5 * np.sin(w_vib) + np.random.normal(0, 0.3)
            wz = 2.5 * np.cos(w_vib * 0.8) + np.random.normal(0, 0.3)
            state = engine.update(t, [ax, ay, az], [wx, wy, wz])
            speeds.append(state.speed)

        peak_speed = max(speeds)
        displacement = np.linalg.norm(engine.p)

        assert peak_speed < 0.5, f"Hard shake peak speed was {peak_speed:.4f} m/s, expected < 0.5 (baseline was 8.25 m/s)"
        assert displacement < 0.8, f"Hard shake displacement was {displacement:.4f}m, expected < 0.8m (baseline was > 2.5m)"
        assert state.motion_state == "SHAKE_PROTECTED"
        assert state.ai_trust == 0.0

        # 1s stationary recovery
        recovery_time = 0.0
        for i in range(50):
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])
            if state.speed < 0.05 and recovery_time == 0.0:
                recovery_time = (i + 1) * dt

        assert recovery_time < 0.5, f"Recovery time was {recovery_time}s, expected < 0.5s"


# ── TEST: LEGITIMATE ACCELERATION & BRAKING ──────────────────────────────────
class Test_LegitimateAccelerationAndBraking:
    def test_aggressive_acceleration_preservation(self):
        """Aggressive acceleration (3.0 m/s^2 forward): AI trust remains 1.0, motion NOT flagged as shake."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s quiet init
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # 3s aggressive forward acceleration (3.0 m/s^2 => phone az = -3.0)
        states = []
        for _ in range(int(3.0 / dt)):
            t += dt
            s = engine.update(t, [0.0, 9.80665, -3.0], [0.0, 0.0, 0.0])
            states.append(s)

        final_speed = engine.v[0]
        displacement = np.linalg.norm(engine.p[:2])
        min_trust = min(s.ai_trust for s in states)
        observed_states = set(s.motion_state for s in states)

        assert final_speed > 8.0, f"Expected speed > 8.0 m/s (~30 km/h), got {final_speed:.2f} m/s"
        assert 11.5 <= displacement <= 15.5, f"Expected ~13.5m displacement, got {displacement:.2f} m"
        assert min_trust == 1.0, f"AI trust must not drop during legitimate acceleration, got {min_trust}"
        assert "SHAKE_PROTECTED" not in observed_states, f"Legitimate acceleration must not be flagged as shake: {observed_states}"

    def test_aggressive_braking_preservation(self):
        """Aggressive braking (-5.0 m/s^2): AI trust remains 1.0, motion NOT flagged as shake."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # Accelerate to ~10 m/s (5.0 m/s^2 for 2s)
        for _ in range(int(2.0 / dt)):
            t += dt
            engine.update(t, [0.0, 9.80665, -5.0], [0.0, 0.0, 0.0])

        # Hard brake to 0 m/s (-5.0 m/s^2 for 2s => phone az = +5.0)
        brake_states = []
        for _ in range(int(2.0 / dt)):
            t += dt
            s = engine.update(t, [0.0, 9.80665, 5.0], [0.0, 0.0, 0.0])
            brake_states.append(s)

        final_speed = engine.v[0]
        min_trust = min(s.ai_trust for s in brake_states)
        observed_states = set(s.motion_state for s in brake_states)

        assert abs(final_speed) < 0.2, f"Expected speed near 0 after braking, got {final_speed:.2f} m/s"
        assert min_trust == 1.0, f"AI trust must not drop during legitimate braking, got {min_trust}"
        assert "SHAKE_PROTECTED" not in observed_states, f"Braking must not be flagged as shake: {observed_states}"


# ── TEST 10: STOP AFTER MOTION ───────────────────────────────────────────────
class Test10_StopAfterMotion:
    def test_stop_after_motion_latching(self):
        """Accelerate to speed, decelerate smoothly to 0, hold stationary. Speed stabilizes to 0."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        engine = AIDREngine(adapter=adapter, use_ai=True)
        dt = 0.02
        t = 1000.0

        # 1s quiet init
        for _ in range(50):
            t += dt
            engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        # 2s accelerate (+1.0 m/s^2 fwd => phone az = -1.0)
        for _ in range(100):
            t += dt
            engine.update(t, [0.0, 9.80665, -1.0], [0.0, 0.0, 0.0])

        # 2s brake (-1.0 m/s^2 brake => phone az = +1.0)
        for _ in range(100):
            t += dt
            engine.update(t, [0.0, 9.80665, 1.0], [0.0, 0.0, 0.0])

        # 2s stationary stop
        for _ in range(100):
            t += dt
            state = engine.update(t, [0.0, 9.80665, 0.0], [0.0, 0.0, 0.0])

        assert state.speed < 0.1, f"Speed after stop was {state.speed:.4f} m/s, expected < 0.1"
        assert state.motion_state == "NORMAL"


from integration.ws_server import AIEKFEngine


# ── TEST 11: GNSS BLACKOUT ───────────────────────────────────────────────────
class Test11_GNSSBlackout:
    def test_gnss_blackout_transition(self):
        """GNSS active -> GNSS blackout -> mode transitions to DR, DR integrates smoothly."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        core_engine = AIDREngine(adapter=adapter, use_ai=False)
        wrapper = GNSSHandoverWrapper(engine=AIEKFEngine(core_engine))
        dt = 0.02
        t = 1000.0

        # Step 1: Align with GNSS
        wrapper.handle_gnss({
            "timestamp": t,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "speed": 5.0
        })

        # Move 10m east
        t += 1.0
        wrapper.handle_gnss({
            "timestamp": t,
            "latitude": 28.6139,
            "longitude": 77.2090 + (10.0 / (6378137.0 * math.cos(math.radians(28.6139)))) * (180.0 / math.pi),
            "speed": 5.0
        })

        assert wrapper.is_aligned, "Wrapper should be aligned after 10m displacement"
        assert wrapper.mode == "GNSS"

        # Step 2: Simulate 3s IMU stream without GNSS -> Blackout triggers
        for _ in range(150):
            t += dt
            wrapper.process_imu({
                "timestamp": t,
                "accelerometer": [0.0, 9.80665, 0.0],
                "gyroscope": [0.0, 0.0, 0.0]
            })

        assert wrapper.mode == "DR", f"Expected mode DR during blackout, got {wrapper.mode}"


# ── TEST 12: GNSS RECOVERY ───────────────────────────────────────────────────
class Test12_GNSSRecovery:
    def test_gnss_recovery_after_blackout(self):
        """DR mode -> GNSS packet received -> mode recovers to GNSS and syncs state."""
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
        core_engine = AIDREngine(adapter=adapter, use_ai=False)
        wrapper = GNSSHandoverWrapper(engine=AIEKFEngine(core_engine))
        dt = 0.02
        t = 1000.0

        # Align
        wrapper.handle_gnss({"timestamp": t, "latitude": 28.6139, "longitude": 77.2090, "speed": 5.0})
        t += 1.0
        wrapper.handle_gnss({
            "timestamp": t,
            "latitude": 28.6139,
            "longitude": 77.2090 + (10.0 / (6378137.0 * math.cos(math.radians(28.6139)))) * (180.0 / math.pi),
            "speed": 5.0
        })

        # Blackout for 3s
        for _ in range(150):
            t += dt
            wrapper.process_imu({"timestamp": t, "accelerometer": [0.0, 9.80665, 0.0], "gyroscope": [0.0, 0.0, 0.0]})

        assert wrapper.mode == "DR"

        # Recovery GNSS packet
        t += 1.0
        wrapper.handle_gnss({
            "timestamp": t,
            "latitude": 28.6140,
            "longitude": 77.2092,
            "speed": 5.0
        })

        assert wrapper.mode == "GNSS", f"Expected mode GNSS upon recovery, got {wrapper.mode}"
