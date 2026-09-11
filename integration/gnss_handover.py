# integration/gnss_handover.py
import math
import numpy as np
import unittest

# --- Isolated Coordinate Helpers ---

def llar_to_enu(lat, lon, alt, ref_lat, ref_lon, ref_alt):
    """Minimal spherical Earth approximation for LLA to Local ENU."""
    R = 6371000.0
    lat_rad, lon_rad = math.radians(lat), math.radians(lon)
    ref_lat_rad, ref_lon_rad = math.radians(ref_lat), math.radians(ref_lon)
    
    x = R * (lon_rad - ref_lon_rad) * math.cos(ref_lat_rad)
    y = R * (lat_rad - ref_lat_rad)
    z = alt - ref_alt
    return np.array([x, y, z], dtype=np.float64).reshape(3, 1)

def speed_heading_to_velocity_enu(speed, heading_deg):
    """Converts speed and true heading to ENU velocity."""
    heading_rad = math.radians(heading_deg)
    v_e = speed * math.sin(heading_rad)
    v_n = speed * math.cos(heading_rad)
    v_u = 0.0
    return np.array([v_e, v_n, v_u], dtype=np.float64).reshape(3, 1)

# --- Handover & ZUPT Wrapper ---

class GNSSHandoverWrapper:
    def __init__(self, engine, zupt_window_size=15):
        """
        Wraps AIEKFEngine for GNSS handover and ZUPT correction.
        """
        self.engine = engine
        self.mode = "UNINITIALIZED"
        self.ref_lat = None
        self.ref_lon = None
        self.ref_alt = 0.0
        
        # ZUPT Tracking
        self.zupt_window_size = zupt_window_size
        self.imu_buffer = []  # Stores tuples of (acc_norm, gyro_norm)
        self.last_gnss_speed = None

    def process_imu(self, imu_sample):
        """Delegates IMU propagation and evaluates ZUPT conditions."""
        if self.mode != "UNINITIALIZED":
            self.engine.predict(imu_sample)
            self._evaluate_zupt(imu_sample)

    def process_gnss(self, timestamp, lat, lon, speed, heading=0.0, alt=0.0, accuracy=None):
        """Anchors the navigation state using GNSS."""
        if self.ref_lat is None:
            self.ref_lat = lat
            self.ref_lon = lon
            self.ref_alt = alt
            
        p_enu = llar_to_enu(lat, lon, alt, self.ref_lat, self.ref_lon, self.ref_alt)
        v_enu = speed_heading_to_velocity_enu(speed, heading)
        
        self.engine.p = p_enu
        self.engine.v = v_enu
        
        self.last_gnss_speed = speed
        self.mode = "GNSS"

    def mark_gnss_lost(self):
        """Transitions to Dead Reckoning mode."""
        if self.mode == "GNSS":
            self.mode = "DR"

    def _evaluate_zupt(self, imu_sample):
        """Minimal ZUPT detector and correction."""
        acc_norm = np.linalg.norm(imu_sample.get('acc', [0, 0, 0]))
        gyro_norm = np.linalg.norm(imu_sample.get('gyro', [0, 0, 0]))
        
        self.imu_buffer.append((acc_norm, gyro_norm))
        if len(self.imu_buffer) > self.zupt_window_size:
            self.imu_buffer.pop(0)
            
        if len(self.imu_buffer) == self.zupt_window_size:
            accs = [x[0] for x in self.imu_buffer]
            gyros = [x[1] for x in self.imu_buffer]
            
            # 1. IMU constraints for standstill
            acc_mean = np.mean(accs)
            acc_std = np.std(accs)
            gyro_max = np.max(gyros)
            
            is_imu_still = (9.6 < acc_mean < 10.0) and (acc_std < 0.1) and (gyro_max < 0.05)
            
            # 2. GNSS cross-check constraint
            is_gnss_still = True
            if self.mode == "GNSS" and self.last_gnss_speed is not None:
                if self.last_gnss_speed > 0.5:  # Moving faster than 0.5 m/s
                    is_gnss_still = False
                    
            # 3. Apply prototype correction
            if is_imu_still and is_gnss_still:
                self.engine.v = np.zeros((3, 1))

# --- Unit Tests ---

class MockAIEKFEngine:
    def __init__(self):
        self.p = np.zeros((3, 1))
        self.v = np.array([[5.0], [0.0], [0.0]]) # Starts with 5m/s velocity
    def predict(self, imu_sample):
        self.p += self.v * 0.1

class TestGNSSHandover(unittest.TestCase):
    def setUp(self):
        self.mock_engine = MockAIEKFEngine()
        self.wrapper = GNSSHandoverWrapper(self.mock_engine, zupt_window_size=5)
        self.wrapper.mode = "DR" # Force initialized state

    def test_zupt_trigger_stationary(self):
        # Feed 5 perfectly still IMU samples
        still_sample = {'acc': [0, 0, 9.81], 'gyro': [0, 0, 0]}
        for _ in range(5):
            self.wrapper.process_imu(still_sample)
        
        # Velocity should be wiped out to zero
        self.assertTrue(np.allclose(self.mock_engine.v, np.zeros((3, 1))))

    def test_zupt_rejected_moving(self):
        # Feed noisy/moving IMU samples
        moving_sample = {'acc': [2.0, 1.0, 9.81], 'gyro': [0.5, 0.1, 0.0]}
        for _ in range(5):
            self.wrapper.process_imu(moving_sample)
            
        # Velocity should remain untouched (5.0 m/s on x)
        self.assertEqual(self.mock_engine.v[0, 0], 5.0)

    def test_zupt_rejected_by_gnss_speed(self):
        # GNSS says we are moving at 10 m/s
        self.wrapper.process_gnss(0.0, 23.0, 77.0, speed=10.0)
        
        # Even if the phone is perfectly still on the car seat...
        still_sample = {'acc': [0, 0, 9.81], 'gyro': [0, 0, 0]}
        for _ in range(5):
            self.wrapper.process_imu(still_sample)
            
        # ZUPT should NOT trigger because GNSS speed > 0.5
        # (Velocity will be 10.0 on North/East axis depending on heading, not zeroed)
        self.assertFalse(np.allclose(self.mock_engine.v, np.zeros((3, 1))))

if __name__ == '__main__':
    unittest.main(verbosity=2)