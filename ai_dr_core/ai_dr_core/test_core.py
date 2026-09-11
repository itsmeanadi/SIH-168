import sys
import os
import time
import numpy as np

# Ensure parent directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_dr_core import (
    AIDREngine,
    SmartphoneIMUAdapter,
    NavState,
    MesNet,
    AICovarianceAdapter,
)

def run_validation():
    print("==================================================")
    print("STEP 6: AI-IMU-DR CORE LIGHTWEIGHT VALIDATION")
    print("==================================================")

    # 1. Test Imports & Model Construction
    print("[1/5] Testing Model & Neural Network Architecture...")
    model = MesNet()
    import torch
    dummy_input = torch.randn(1, 6, 25, dtype=torch.float64)
    dummy_cov0 = torch.tensor([1.0, 10.0], dtype=torch.float64)
    out_cov = model(dummy_input, dummy_cov0)
    assert out_cov.shape == (25, 2), f"Expected shape (25, 2), got {out_cov.shape}"
    print(f"  -> MesNet output shape: {out_cov.shape}, sample cov: {out_cov[-1].detach().numpy()}")
    print("  -> MesNet forward pass: PASSED")

    # 2. Test Sensor Adapter (Smartphone IMU)
    print("\n[2/5] Testing Smartphone IMU Adapter...")
    adapter = SmartphoneIMUAdapter(mounting_preset="PORTRAIT_DASHBOARD")
    # Phone vertical: phone +Y is Up (+9.81 m/s^2), moving forward
    phone_accel = [0.0, 9.80665, -0.5]  # slightly accelerating forward (-Z in portrait)
    phone_gyro = [0.0, 0.05, 0.0]       # rotating around +Y
    imu_sample = adapter.process(timestamp=1000.0, accel=phone_accel, gyro=phone_gyro)
    print(f"  -> Raw phone accel: {phone_accel}")
    print(f"  -> Transformed vehicle accel [Fwd, Left, Up]: {imu_sample.accel}")
    print(f"  -> Transformed vehicle gyro  [Fwd, Left, Up]: {imu_sample.gyro}")
    assert np.isclose(imu_sample.accel[0], 0.5), f"Expected fwd accel 0.5, got {imu_sample.accel[0]}"
    assert np.isclose(imu_sample.accel[2], 9.80665), f"Expected up accel 9.81, got {imu_sample.accel[2]}"
    print("  -> Smartphone Adapter coordinate transformation: PASSED")

    # 3. Test AI-DR Engine Initialization
    print("\n[3/5] Testing AIDREngine Initialization...")
    engine = AIDREngine(adapter=adapter, use_ai=True)
    engine.set_initial_state(
        position=np.array([0.0, 0.0, 0.0]),
        velocity=np.array([0.0, 0.0, 0.0]),
        roll_pitch_yaw_deg=(0.0, 0.0, 90.0)  # Initial heading 90 deg (East)
    )
    print(f"  -> Initial Position: {engine.p}")
    print(f"  -> Initial Velocity: {engine.v}")
    print(f"  -> Initial State Setup: PASSED")

    # 4. Test Single Step Update
    print("\n[4/5] Testing Single-Step Update: state = engine.update(...)")
    t0 = 1000.0
    phone_stationary = [0.0, 9.80665, 0.0]
    state0 = engine.update(t0, phone_stationary, [0.0, 0.0, 0.0])
    assert isinstance(state0, NavState)

    # Second step at t + 20ms (50 Hz smartphone rate)
    t1 = t0 + 0.02
    state1 = engine.update(t1, phone_accel, phone_gyro)
    print(f"  -> Update t={state1.timestamp:.3f}s:")
    print(f"     Position: [{state1.position[0]:.4f}, {state1.position[1]:.4f}, {state1.position[2]:.4f}] m")
    print(f"     Speed:    {state1.speed:.3f} m/s ({state1.speed_kmh:.2f} km/h)")
    print(f"     Euler:    Roll={state1.orientation_euler[0]:.2f}°, Pitch={state1.orientation_euler[1]:.2f}°, Yaw={state1.orientation_euler[2]:.2f}°")
    print(f"     AI Cov:   Lateral={state1.cov_measurement[0]:.3f}, Up={state1.cov_measurement[1]:.3f}")
    print("  -> Single-step update: PASSED")

    # 5. Test Synthetic 10-Second Vehicle Trajectory Simulation
    print("\n[5/5] Testing 10-second Synthetic Trajectory (50 Hz, 500 samples)...")
    dt = 0.02  # 50 Hz
    cur_t = t1
    positions = []

    # Simulate 5s accelerating to 10 m/s (36 km/h), then 5s cruising with a slight turn
    for step in range(500):
        cur_t += dt
        if step < 250:
            # Forward accel ~ 0.4 m/s^2, gravity up
            a = [0.0, 9.80665, -0.4]
            w = [0.0, 0.0, 0.0]
        else:
            # Cruising at speed, gentle 5 deg/s left turn
            a = [0.0, 9.80665, 0.0]
            w = [0.0, np.radians(5.0), 0.0]

        state = engine.update(cur_t, a, w)
        positions.append(state.position.copy())

    final_pos = positions[-1]
    dist = np.linalg.norm(final_pos[:2])
    print(f"  -> Final Position after 10s: X={final_pos[0]:.2f}m, Y={final_pos[1]:.2f}m, Z={final_pos[2]:.2f}m")
    print(f"  -> Total Horizontal Distance Traveled: {dist:.2f}m")
    print(f"  -> Final Speed: {state.speed_kmh:.1f} km/h")
    print(f"  -> Final Yaw: {state.orientation_euler[2]:.1f}°")
    print(f"  -> Estimated Gyro Bias: {state.gyro_bias}")
    print(f"  -> Estimated Accel Bias: {state.accel_bias}")

    assert dist > 10.0, f"Vehicle should have traveled forward, got distance {dist}m"
    assert abs(final_pos[2]) < 1.0, f"Vertical drift should be constrained near 0 by NHC, got Z={final_pos[2]}m"
    print("  -> NHC Vertical Drift Constraint: PASSED (Z < 1.0m over 10s)")
    print("  -> 10-second Trajectory Simulation: PASSED")

    print("\n==================================================")
    print("ALL AI-DR CORE VALIDATION CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_validation()
