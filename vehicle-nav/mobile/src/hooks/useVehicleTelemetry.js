import { useEffect, useRef, useState, useCallback } from "react";
import { WEBSOCKET_URL as DEFAULT_WS_URL } from "../constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ============================================================
// SIH-168 — useVehicleTelemetry Custom Hook
// Encapsulates all WebSocket lifecycle, telemetry parsing,
// exponential backoff reconnection, and ZUPT deadband logic.
// ============================================================

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 16000;
// Helps prevent GPS noise from causing the map to drift or spin while stopped.
const SPEED_DEADBAND_KMH = 0.5;

export default function useVehicleTelemetry() {
  // --- Telemetry State ---
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [navMode, setNavMode] = useState("ALIGNING");
  const [isAligned, setIsAligned] = useState(false);
  const [motionState, setMotionState] = useState("NORMAL");
  const [aiTrust, setAiTrust] = useState(1.0);
  const [isZuptActive, setIsZuptActive] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(0.0);
  const [headingDeg, setHeadingDeg] = useState(0.0);
  const [vehiclePos, setVehiclePos] = useState(null);

  // --- Transition Banners ---
  const [blackoutBanner, setBlackoutBanner] = useState(false);
  const [recoveryBanner, setRecoveryBanner] = useState(false);

  // --- Internal refs ---
  const wsRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const blackoutTimerRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const prevNavModeRef = useRef("ALIGNING");
  const headingRef = useRef(0);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);

  // --- V2V State ---
  const [v2vSyncMessage, setV2vSyncMessage] = useState(null);
  const [sosBanner, setSosBanner] = useState(false);

  // --- Parsed message callback (for forwarding to WebView etc.) ---
  const onMessageCallbackRef = useRef(null);

  const setOnMessage = useCallback((cb) => {
    onMessageCallbackRef.current = cb;
  }, []);

  // --- Connect ---
  const connect = useCallback(async () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      // Force close old connection if user changed URL
      wsRef.current.close();
    }

    setConnectionStatus("CONNECTING");
    setIsReconnecting(true);

    try {
      let activeWsUrl = DEFAULT_WS_URL;
      try {
        const savedUrl = await AsyncStorage.getItem("custom_ws_url");
        if (savedUrl) activeWsUrl = savedUrl;
      } catch (e) {
        console.log(e);
      }

      const ws = new WebSocket(activeWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log("[WS] Connected to SIH-168 Telemetry Server:", activeWsUrl);
        setConnectionStatus("CONNECTED");
        setIsReconnecting(false);
        backoffRef.current = INITIAL_BACKOFF_MS; // Reset backoff on success

        ws.send(
          JSON.stringify({
            type: "config",
            mounting_preset: "PORTRAIT_DASHBOARD",
          })
        );
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("DISCONNECTED");
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (unless intentionally closed)
        if (!intentionalCloseRef.current) {
          setIsReconnecting(true);
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);

          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.log("[WS] Error:", err?.message || "connection failed");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "v2v_correction") {
            console.log("[V2V] Received Anchor:", data);

            // Handle Emergency SOS
            if (data.is_sos) {
              setSosBanner(true);
              setTimeout(() => setSosBanner(false), 10000);
            }

            if (typeof data.lat === "number" && typeof data.lng === "number") {
              const newPos = { lat: data.lat, lng: data.lng };
              setVehiclePos(newPos);
              if (data.heading) setHeadingDeg(data.heading);

              setV2vSyncMessage("V2V SYNC: Drift Corrected Successfully");
              setTimeout(() => setV2vSyncMessage(null), 5000);

              // Forward instantly to webview
              if (onMessageCallbackRef.current) {
                onMessageCallbackRef.current({
                  lat: data.lat,
                  lng: data.lng,
                  heading: data.heading || headingRef.current,
                  speed: 0.0,
                  navMode: "GNSS", // Temporary force to GNSS to show green
                  isAligned: true,
                  motionState: "NORMAL",
                  aiTrust: 1.0,
                  zuptActive: false,
                });
              }
            }
            return;
          }

          if (data.type !== "vehicle_position") return;

          const rawSpeed = typeof data.speed === "number" ? data.speed : 0.0;
          const zupt = Boolean(data.zupt_active);
          const aligned = Boolean(data.is_aligned);
          const newSpeed = (!aligned || zupt || rawSpeed < SPEED_DEADBAND_KMH)
            ? 0.0
            : rawSpeed;
          const newLat = data.lat;
          const newLng = data.lng;
          const mode = data.nav_mode || (aligned ? "GNSS" : "ALIGNING");
          const motion = data.motion_state || "NORMAL";
          const trust = typeof data.ai_trust === "number" ? data.ai_trust : 1.0;

          // Heading: Lock to last known heading when stationary (speed 0)
          let calculatedHeading = headingRef.current;
          if (newSpeed > 0 && typeof data.heading === "number" && !isNaN(data.heading)) {
            calculatedHeading = Math.round(((data.heading % 360) + 360) % 360);
            headingRef.current = calculatedHeading;
            setHeadingDeg(calculatedHeading);
          }

          setSpeedKmh(newSpeed);
          setIsAligned(aligned);
          setMotionState(motion);
          setAiTrust(trust);
          setIsZuptActive(zupt);

          // Position
          if (
            typeof newLat === "number" &&
            typeof newLng === "number" &&
            (newLat !== 0 || newLng !== 0)
          ) {
            const newPos = { lat: newLat, lng: newLng };
            setVehiclePos(newPos);
          }

          // Mode Transition Banners
          if (prevNavModeRef.current === "GNSS" && mode === "DR") {
            setBlackoutBanner(true);
            setRecoveryBanner(false);
            if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
            blackoutTimerRef.current = setTimeout(() => setBlackoutBanner(false), 5000);
          } else if (prevNavModeRef.current === "DR" && mode === "GNSS") {
            setRecoveryBanner(true);
            setBlackoutBanner(false);
            if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
            recoveryTimerRef.current = setTimeout(() => setRecoveryBanner(false), 4000);
          }
          prevNavModeRef.current = mode;
          setNavMode(mode);

          // Forward parsed telemetry to consumer callback
          if (onMessageCallbackRef.current) {
            onMessageCallbackRef.current({
              lat: newLat,
              lng: newLng,
              heading: calculatedHeading,
              speed: newSpeed,
              navMode: mode,
              isAligned: aligned,
              motionState: motion,
              aiTrust: trust,
              zuptActive: zupt,
            });
          }
        } catch (e) {
          console.log("[WS] Message parsing error:", e);
        }
      };
    } catch (e) {
      console.log("[WS] Init exception:", e);
      setConnectionStatus("DISCONNECTED");
    }
  }, []);

  // --- Send raw message to WS ---
  const sendMessage = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
      } catch (_) { }
    }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("DISCONNECTED");
    setIsReconnecting(false);
  }, []);

  // --- Lifecycle ---
  useEffect(() => {
    mountedRef.current = true;
    // Initial connect
    connect();

    // Check connection health every 5s
    const healthInterval = setInterval(() => {
      intentionalCloseRef.current = false;
      connect();
    }, 5000);

    return () => {
      mountedRef.current = false;
      disconnect();
      clearInterval(healthInterval);
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, [connect, disconnect]);

  // --- Global Hooks for V2V ---
  useEffect(() => {
    global.broadcastV2VAnchor = (isSos = false) => {
      if (vehiclePos) {
        sendMessage({
          type: "v2v_broadcast",
          lat: vehiclePos.lat,
          lng: vehiclePos.lng,
          heading: headingDeg,
          sender: "DeviceA",
          is_sos: isSos
        });
        console.log(`[V2V] Broadcasting Anchor at:`, vehiclePos, `SOS: ${isSos}`);
      }
    };

    // global.scanV2VAnchors is just a UI hook, the reception is automatic
    global.scanV2VAnchors = () => {
      console.log("[V2V] Scanning for anchors...");
    };
  }, [vehiclePos, headingDeg, sendMessage]);

  return {
    // Connection
    connectionStatus,
    isReconnecting,
    connect,
    disconnect,
    sendMessage,
    wsRef,

    // Telemetry
    navMode,
    isAligned,
    motionState,
    aiTrust,
    isZuptActive,
    speedKmh,
    headingDeg,
    vehiclePos,

    // Setters (for fallback GPS / on-device DR overrides)
    setSpeedKmh,
    setHeadingDeg,
    setVehiclePos,
    setNavMode,
    setIsAligned,
    setMotionState,
    setAiTrust,
    setIsZuptActive,

    // Banners
    blackoutBanner,
    setBlackoutBanner,
    recoveryBanner,
    setRecoveryBanner,
    v2vSyncMessage,
    sosBanner,

    // Expose connect method so App.js can force reconnect
    connect,

    // Callback registration
    setOnMessage,
  };
}
