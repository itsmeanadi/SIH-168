# File: ai_dr_core/ai_dr_core/test_static_alignment.py
"""
Focused regression tests for the static gravity / roll-pitch initialisation
added to AIDREngine.

Convention reminder (ZYX body-to-world, Rot = Rz(yaw)*Ry(pitch)*Rx(roll)):
    At rest: Rot * f_b + g_world = 0
             => Rot * f_b = [0, 0, +9.80655]   (pointing world-up)
    Gravity does NOT constrain yaw; yaw is left at its current value.

Tests A-C correspond exactly to the requirements stated in the task.
"""

import sys
import os
import math
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_dr_core.engine import AIDREngine, EngineParameters
from ai_dr_core.sensor_adapter import SmartphoneIMUAdapter
from ai_dr_core.lie_algebra import from_rpy

G = 9.80655  # m/s²  (same constant used by EngineParameters.g)
# Gravity in ENU world frame (pointing down = -Z)
G_WORLD = np.array([0.0, 0.0, -G])

# ── helpers ──────────────────────────────────────────────────────────────────

def _acc_world_after_first_step(phone_accel_g, dt=0.02,
                                 preset="PORTRAIT_DASHBOARD",
                                 gyro=None):
    """
    Build an engine, feed one initialisation sample then one propagation step,
    and return the world-frame acceleration produced by _propagate.

    phone_accel_g: [ax, ay, az] as read by expo-sensors (in g units)
    Returns: acc_world vector [m/s²]
    """
    if gyro is None:
        gyro = [0.0, 0.0, 0.0]

    adapter = SmartphoneIMUAdapter(mounting_preset=preset,
                                   auto_detect_accel_units=True)
    engine = AIDREngine(adapter=adapter, use_ai=False)

    t0 = 1_700_000_000.0
    # First call — triggers static alignment
    engine.update(t0, phone_accel_g, gyro)

    # Second call — one real propagation step with same sensor reading
    t1 = t0 + dt
    imu = adapter.process(t1, phone_accel_g, gyro)
    acc_body = imu.accel - engine.b_acc          # subtract (zero) bias
    acc_world = engine.Rot.dot(acc_body) + G_WORLD
    return acc_world


def _horizontal_speed_after_n_seconds(phone_accel_g, duration=10.0, dt=0.02,
                                       preset="PORTRAIT_DASHBOARD",
                                       gyro=None):
    """Simulate n seconds of stationary IMU data and return final speed (m/s)."""
    if gyro is None:
        gyro = [0.0, 0.0, 0.0]

    adapter = SmartphoneIMUAdapter(mounting_preset=preset,
                                   auto_detect_accel_units=True)
    engine = AIDREngine(adapter=adapter, use_ai=False)

    t = 1_700_000_000.0
    n = int(duration / dt)
    state = None
    for i in range(n):
        state = engine.update(t, phone_accel_g, gyro)
        t += dt
    return float(np.linalg.norm(engine.v))


# ── TEST A ───────────────────────────────────────────────────────────────────

class TestA_UprightPhoneGravityCancel:
    """
    A) Phone perfectly upright in PORTRAIT_DASHBOARD mount.
       Gravity should cancel completely after static alignment.
       acc_world ≈ [0, 0, 0].
    """

    def test_acc_world_forward_near_zero_upright(self):
        """Forward (x) world acceleration must be < 0.05 m/s²."""
        # expo-sensors portrait upright: x≈0, y≈+1g (up), z≈0
        acc_g = [0.0, 1.0, 0.0]
        aw = _acc_world_after_first_step(acc_g)
        assert abs(aw[0]) < 0.05, (
            f"Forward world accel={aw[0]:.4f} m/s² expected < 0.05 (gravity leaking forward)"
        )

    def test_acc_world_lateral_near_zero_upright(self):
        """Lateral (y) world acceleration must be < 0.05 m/s²."""
        acc_g = [0.0, 1.0, 0.0]
        aw = _acc_world_after_first_step(acc_g)
        assert abs(aw[1]) < 0.05, (
            f"Lateral world accel={aw[1]:.4f} m/s² expected < 0.05"
        )

    def test_acc_world_vertical_near_zero_upright(self):
        """Vertical (z) world acceleration must be < 0.1 m/s²."""
        acc_g = [0.0, 1.0, 0.0]
        aw = _acc_world_after_first_step(acc_g)
        assert abs(aw[2]) < 0.1, (
            f"Vertical world accel={aw[2]:.4f} m/s² expected < 0.1"
        )

    def test_stationary_speed_stays_low_upright(self):
        """After 10 s stationary, speed must be < 0.5 m/s (< 1.8 km/h)."""
        acc_g = [0.0, 1.0, 0.0]
        speed = _horizontal_speed_after_n_seconds(acc_g, duration=10.0)
        assert speed < 0.5, (
            f"Speed after 10 s stationary (upright) = {speed:.3f} m/s, expected < 0.5"
        )


# ── TEST B ───────────────────────────────────────────────────────────────────

class TestB_TiltedPhoneGravityCancel:
    """
    B) Phone tilted at various angles.
       After static alignment, gravity should still cancel.
       Without the fix, a 10° forward tilt would give ~1.7 m/s² leakage.
    """

    @pytest.mark.parametrize("tilt_deg", [5, 10, 15, 20])
    def test_forward_tilt_acc_world_near_zero(self, tilt_deg):
        """
        Simulate phone tilted forward (positive pitch) by tilt_deg degrees.
        In PORTRAIT_DASHBOARD, phone Y is vehicle Up, phone Z is vehicle -Forward.
        A forward tilt rotates gravity into the phone -Z direction:
            ay = cos(tilt) [g],  az = -sin(tilt) [g]
        After mounting (Vehicle Fwd = -Z_phone): vehicle_fwd component = sin(tilt)*g.
        Without fix: gravity leaks forward.  With fix: should cancel.
        """
        tilt_rad = math.radians(tilt_deg)
        # Phone tilted forward: gravity projects onto y and -z axes of phone
        ay = math.cos(tilt_rad)   # still mostly up (y)
        az = -math.sin(tilt_rad)  # forward component on -z
        acc_g = [0.0, ay, az]

        aw = _acc_world_after_first_step(acc_g)
        # Forward world acceleration must be < 0.15 m/s² regardless of tilt
        assert abs(aw[0]) < 0.15, (
            f"Tilt {tilt_deg}°: forward world accel={aw[0]:.4f} m/s² (should be ~0 after alignment)"
        )

    @pytest.mark.parametrize("tilt_deg", [5, 10, 15])
    def test_forward_tilt_speed_stays_low(self, tilt_deg):
        """After 10 s stationary with forward tilt, speed must be < 0.5 m/s."""
        tilt_rad = math.radians(tilt_deg)
        ay = math.cos(tilt_rad)
        az = -math.sin(tilt_rad)
        acc_g = [0.0, ay, az]
        speed = _horizontal_speed_after_n_seconds(acc_g, duration=10.0)
        assert speed < 0.5, (
            f"Tilt {tilt_deg}°: speed after 10 s = {speed:.3f} m/s (should be < 0.5)"
        )

    @pytest.mark.parametrize("tilt_deg", [5, 10])
    def test_lateral_tilt_acc_world_near_zero(self, tilt_deg):
        """Phone rolled sideways: gravity into phone X axis, should also cancel."""
        tilt_rad = math.radians(tilt_deg)
        # Roll: gravity projects onto phone x and y axes
        ax = math.sin(tilt_rad)
        ay = math.cos(tilt_rad)
        acc_g = [ax, ay, 0.0]

        aw = _acc_world_after_first_step(acc_g)
        # Lateral world acceleration must be suppressed
        assert abs(aw[1]) < 0.15, (
            f"Roll {tilt_deg}°: lateral world accel={aw[1]:.4f} m/s² (should be ~0 after alignment)"
        )


# ── TEST C ───────────────────────────────────────────────────────────────────

class TestC_PropagationIntact:
    """
    C) Verify that existing propagation behaviour is unaffected.
       A real forward acceleration must still appear in world frame.
       Yaw must NOT be disturbed by the gravity alignment.
    """

    def test_real_forward_acceleration_detected(self):
        """
        When the vehicle genuinely accelerates forward, world-frame forward
        acceleration must be significantly positive (not cancelled by alignment).
        """
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD",
                                       auto_detect_accel_units=True)
        engine = AIDREngine(adapter=adapter, use_ai=False)

        t0 = 1_700_000_000.0
        # First sample: stationary upright → triggers alignment
        engine.update(t0, [0.0, 1.0, 0.0], [0.0, 0.0, 0.0])

        # Second sample: phone upright + real forward acceleration 0.5 m/s²
        # In portrait, phone -Z = vehicle Forward → az = -0.5/G contribution
        fwd_g = 0.5 / G          # ~0.051 g extra in -Z_phone direction
        fwd_accel_g = [0.0, 1.0, -fwd_g]
        imu = adapter.process(t0 + 0.02, fwd_accel_g, [0.0, 0.0, 0.0])
        acc_body = imu.accel - engine.b_acc
        acc_world = engine.Rot.dot(acc_body) + G_WORLD

        # World forward acceleration should be ~0.5 m/s² (the real vehicle accel)
        assert acc_world[0] > 0.3, (
            f"Real forward accel not detected after alignment: acc_world[0]={acc_world[0]:.4f}"
        )

    def test_set_initial_state_yaw_preserved(self):
        """
        If set_initial_state is called with yaw=90°, static alignment must
        preserve that yaw (gravity cannot determine yaw).
        """
        from ai_dr_core.lie_algebra import to_rpy

        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD",
                                       auto_detect_accel_units=True)
        engine = AIDREngine(adapter=adapter, use_ai=False)
        # Set explicit yaw before the first update
        engine.set_initial_state(roll_pitch_yaw_deg=(0.0, 0.0, 90.0))

        # Phone upright: triggers alignment
        engine.update(1_700_000_000.0, [0.0, 1.0, 0.0], [0.0, 0.0, 0.0])

        _, _, yaw_out = to_rpy(engine.Rot)
        yaw_deg = math.degrees(yaw_out)

        assert abs(yaw_deg - 90.0) < 1.0, (
            f"Yaw was disturbed by static alignment: expected 90°, got {yaw_deg:.2f}°"
        )

    def test_alignment_fires_only_once(self):
        """
        _static_tilt_initialized must be True after the first update call,
        ensuring the one-shot init does not repeat.
        """
        adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD",
                                       auto_detect_accel_units=True)
        engine = AIDREngine(adapter=adapter, use_ai=False)

        assert not engine._static_tilt_initialized, "Flag should be False before first update"
        engine.update(1_700_000_000.0, [0.0, 1.0, 0.0], [0.0, 0.0, 0.0])
        assert engine._static_tilt_initialized, "Flag must be True after first update"

        # Capture Rot after alignment
        rot_after_first = engine.Rot.copy()

        # Feed a totally different (tilted) sample — should NOT re-align
        engine.update(1_700_000_000.02, [0.5, 0.86, 0.0], [0.0, 0.0, 0.0])
        # Rot will have changed (due to _propagate gyro), but NOT due to re-alignment.
        # We can't easily check Rot equality after propagation, but we can
        # verify the flag remains True and no exception was raised.
        assert engine._static_tilt_initialized

    def test_velocity_zero_after_stationary_10s(self):
        """
        Combined regression: 10 seconds of stationary PORTRAIT_DASHBOARD data
        must not drive speed above 0.5 m/s after the fix.
        Without the fix this produces ~14 m/s.
        """
        speed = _horizontal_speed_after_n_seconds(
            [0.0, 1.0, 0.0], duration=10.0, preset="PORTRAIT_DASHBOARD"
        )
        assert speed < 0.5, (
            f"Stationary 10 s speed = {speed:.3f} m/s — gravity still leaking! "
            f"Expected < 0.5 m/s after static alignment fix."
        )
