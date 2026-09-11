# IDR Real-World Testing Guide

This guide provides instructions for validating the Intelligent Dead Reckoning (IDR) system using a physical smartphone.

## 1. Prerequisites
- **Server**: Laptop running the IDR Telemetry Server.
- **Client**: Smartphone with the IDR Telemetry App installed.
- **Network**: Both devices must be connected to the same Wi-Fi network.

## 2. Server Setup
### Launching the Server
1. Open a terminal in the project root.
2. Run the server:
   ```bash
   export PYTHONPATH=$PYTHONPATH:$(pwd)/ai_dr_core:$(pwd)
   python integration/ws_server.py
   ```
3. **Port Conflict**: If you see `OSError: [Errno 10048]`, the port is blocked. Kill the previous process:
   ```bash
   # Windows
   taskkill /F /IM python.exe
   # Linux/Mac
   lsof -ti:8765 | xargs kill -9
   ```

### Connection IP
The server binds to `0.0.0.0:8765`. In the mobile app, enter the **Local IP address** of your laptop (e.g., `192.168.1.15`), NOT `localhost`.

## 3. Validation Procedure

### Phase 1: Alignment (The "S-Curve" or Straight Line)
The engine needs to align its coordinate system with the real world.
1. Start the app and ensure the server shows `WebSocket: CONNECTED`.
2. Drive the vehicle in a straight line for at least **5 meters** at a speed $> 3\text{ m/s}$.
3. **Verification**: Watch the server console. The `Alignment` status should change from `WAITING` $\rightarrow$ `ALIGNED`.

### Phase 2: GNSS Tracking
1. Continue driving in an open area.
2. **Verification**: Ensure `Mode` is `GNSS` and `Nav Rate` is $\approx 10\text{ Hz}$.

### Phase 3: GNSS Blackout (The Tunnel Test)
1. Drive into a tunnel, under a bridge, or into a parking garage where GNSS signal is lost.
2. **Verification**:
   - The server should detect the loss of GNSS.
   - After 2 seconds, the `Mode` should switch from `GNSS` $\rightarrow$ `DR`.
   - The vehicle position should continue to update based on IMU data.

### Phase 4: Recovery
1. Exit the signal-blocked area.
2. **Verification**:
   - Once GNSS packets resume, the `Mode` should switch `DR` $\rightarrow$ `GNSS`.
   - The position should "snap" back to the correct GNSS coordinate.

## 4. Diagnostics & Troubleshooting
- **Rejected Packets**: If `Rejected Pkts` increases rapidly, check for:
  - Large gaps in IMU timestamps (indicates phone app crashing or network lag).
  - Incorrect timestamp formats (should be Unix seconds).
- **Rate Check**:
  - IMU Rate should be $\approx 30\text{--}100\text{ Hz}$.
  - GNSS Rate should be $\approx 1\text{ Hz}$.
- **Logs**: Every session is saved to `logs/session_YYYYMMDD_HHMMSS.jsonl`. These can be used for post-hoc drift analysis.
