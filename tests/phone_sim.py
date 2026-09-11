# File: tests/phone_sim.py

import asyncio
import json
import time
import math
import random
import websockets

# CONFIG
SERVER_URL = "ws://localhost:8765"
IMU_RATE = 50  # Hz
GNSS_RATE = 1  # Hz

async def simulate_phone():
    print(f"Connecting to IDR Server at {SERVER_URL}...")
    try:
        async with websockets.connect(SERVER_URL) as websocket:
            print("Connected!")

            # Start time
            start_ts = time.time()

            # Initial position (Delhi)
            lat = 28.6139
            lon = 77.2090

            # Simulation state
            distance_traveled = 0.0
            speed = 0.0 # m/s
            heading = 90.0 # East (degrees)

            # Mode control
            gnss_enabled = True

            print("\nStarting simulation...")
            print("1. Accelerating to 5 m/s (Alignment phase)")
            print("2. Cruising for 10 seconds")
            print("3. GNSS Blackout for 5 seconds")
            print("4. GNSS Recovery")
            print("--------------------------------------------------")

            # 1. Alignment Phase: Accelerate and move
            # Needs > 3m/s and > 5m displacement
            for i in range(100): # 2 seconds at 50Hz
                ts = time.time()

                # IMU: Accelerating forward (Vehicle X)
                # In PORTRAIT_DASHBOARD: Vehicle Fwd = -Z_phone
                # So we send a negative Z acceleration
                accel = [0.0, 0.0, -1.0] # 1 m/s^2 forward
                gyro = [0.0, 0.0, 0.0]

                imu_packet = {
                    "type": "imu",
                    "timestamp": ts,
                    "accelerometer": accel,
                    "gyroscope": gyro
                }
                await websocket.send(json.dumps(imu_packet))

                # GNSS every 1s
                if i % IMU_RATE == 0:
                    speed += 1.0 * (1.0/IMU_RATE)
                    distance_traveled += speed * (1.0/IMU_RATE)

                    # Update LatLon based on East heading
                    lon += (distance_traveled * 0.00001) # Rough approx

                    gnss_packet = {
                        "type": "gnss",
                        "timestamp": ts,
                        "latitude": lat,
                        "longitude": lon,
                        "speed": speed,
                        "heading": heading,
                        "accuracy": 2.0
                    }
                    await websocket.send(json.dumps(gnss_packet))

                await asyncio.sleep(1.0/IMU_RATE)

            print("Alignment phase complete. Cruising...")

            # 2. Cruising
            for i in range(500): # 10 seconds
                ts = time.time()
                accel = [0.0, 0.0, 0.0] # Constant speed
                gyro = [0.0, 0.0, 0.0]

                await websocket.send(json.dumps({
                    "type": "imu", "timestamp": ts, "accelerometer": accel, "gyroscope": gyro
                }))

                if i % IMU_RATE == 0:
                    distance_traveled += speed * 1.0
                    lon += (1.0 * 0.00001)
                    await websocket.send(json.dumps({
                        "type": "gnss", "timestamp": ts, "latitude": lat, "longitude": lon, "speed": speed, "heading": heading, "accuracy": 2.0
                    }))

                await asyncio.sleep(1.0/IMU_RATE)

            # 3. Blackout
            print("\n[SIM] Triggering GNSS Blackout...")
            gnss_enabled = False
            for i in range(250): # 5 seconds
                ts = time.time()
                await websocket.send(json.dumps({
                    "type": "imu", "timestamp": ts, "accelerometer": [0.0, 0.0, 0.0], "gyroscope": [0.0, 0.0, 0.0]
                }))

                # No GNSS packets sent here
                await asyncio.sleep(1.0/IMU_RATE)

            # 4. Recovery
            print("\n[SIM] Restoring GNSS...")
            gnss_enabled = True
            for i in range(250): # 5 seconds
                ts = time.time()
                await websocket.send(json.dumps({
                    "type": "imu", "timestamp": ts, "accelerometer": [0.0, 0.0, 0.0], "gyroscope": [0.0, 0.0, 0.0]
                }))

                if i % IMU_RATE == 0:
                    lon += (1.0 * 0.00001)
                    await websocket.send(json.dumps({
                        "type": "gnss", "timestamp": ts, "latitude": lat, "longitude": lon, "speed": speed, "heading": heading, "accuracy": 2.0
                    }))

                await asyncio.sleep(1.0/IMU_RATE)

            print("\nSimulation finished.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(simulate_phone())
