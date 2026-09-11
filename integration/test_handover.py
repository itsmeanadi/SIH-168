# File: integration/test_handover.py

import math
import numpy as np
import pytest
from integration.gnss_handover import GNSSHandoverWrapper

class MockEngine:
    def __init__(self):
        self.p = np.zeros(3)  # Modified to support state injection
        self.predict_called = False
        self.update_called = False
        self.last_y = None
        self.last_R = None

    def predict(self, imu_sample):
        self.predict_called = True

    def update(self, y, R):
        self.update_called = True
        self.last_y = y
        self.last_R = R


# ... (existing tests preserved: test_gnss_timeout, test_zupt_triggers, test_zupt_dr) ...


def test_no_alignment_from_single_gnss():
    engine = MockEngine()
    wrapper = GNSSHandoverWrapper(engine)
    
    wrapper.handle_gnss({"timestamp": 1.0, "latitude": 10.0, "longitude": 20.0, "speed": 5.0})
    
    assert wrapper.is_aligned is False
    assert wrapper.gnss_origin_lat == 10.0
    assert engine.p[0] == 0.0  # Assures no position injection


def test_alignment_conditions():
    engine = MockEngine()
    wrapper = GNSSHandoverWrapper(engine)
    
    # 1. Establish Origin
    wrapper.handle_gnss({"timestamp": 1.0, "latitude": 0.0, "longitude": 0.0, "speed": 0.0})
    
    # 2. Stationary GNSS does not align (speed < 3.0) despite large distance
    lat_11m = math.degrees(11.0 / 6378137.0)
    wrapper.handle_gnss({"timestamp": 2.0, "latitude": lat_11m, "longitude": 0.0, "speed": 0.0})
    assert wrapper.is_aligned is False
    
    # 3. Insufficient displacement does not align (dist < 5.0) despite high speed
    lat_2m = math.degrees(2.0 / 6378137.0)
    wrapper.handle_gnss({"timestamp": 3.0, "latitude": lat_2m, "longitude": 0.0, "speed": 5.0})
    assert wrapper.is_aligned is False
    
    # 4. Valid moving fix triggers alignment
    lat_10m = math.degrees(10.0 / 6378137.0)
    wrapper.handle_gnss({"timestamp": 4.0, "latitude": lat_10m, "longitude": 0.0, "speed": 5.0})
    assert wrapper.is_aligned is True


def test_gnss_coordinates_correctly_rotated_after_alignment():
    engine = MockEngine()
    wrapper = GNSSHandoverWrapper(engine)
    ref_lat, ref_lon = 0.0, 0.0
    
    # Fix 1: Origin
    wrapper.handle_gnss({"timestamp": 1.0, "latitude": ref_lat, "longitude": ref_lon, "speed": 5.0})
    
    # Fix 2: Move purely North by 50m to trigger alignment
    lat_50m_north = math.degrees(50.0 / 6378137.0)
    wrapper.handle_gnss({"timestamp": 2.0, "latitude": lat_50m_north, "longitude": ref_lon, "speed": 5.0})
    
    assert wrapper.is_aligned is True
    assert math.isclose(wrapper.gnss_yaw_offset, math.pi / 2, rel_tol=1e-5)
    
    # After alignment, ENU North maps directly to engine +X (forward)
    assert math.isclose(engine.p[0], 50.0, rel_tol=1e-5)
    assert math.isclose(engine.p[1], 0.0, abs_tol=1e-5)
    
    # Fix 3: Move purely East from origin by 50m
    lon_50m_east = math.degrees(50.0 / 6378137.0)
    wrapper.handle_gnss({"timestamp": 3.0, "latitude": ref_lat, "longitude": lon_50m_east, "speed": 5.0})
    
    # ENU East maps to engine -Y (left-side in a +X forward right-handed coordinate frame)
    assert math.isclose(engine.p[0], 0.0, abs_tol=1e-5)
    assert math.isclose(engine.p[1], -50.0, rel_tol=1e-5)