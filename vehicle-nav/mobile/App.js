import React, { useEffect, useRef, useState, useCallback } from "react";
import { StatusBar, View, Text, Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Accelerometer, Gyroscope } from "expo-sensors";

import { WEBSOCKET_URL, G_TO_MS2 } from "./src/constants/config";
import useVehicleTelemetry from "./src/hooks/useVehicleTelemetry";
import { styles } from "./src/styles/appStyles";
import {
  getRoute,
  isOffRoute,
  getDistanceMeters,
  formatDistance,
  formatDuration,
  calculateEtaTime,
  searchPlaces,
  reverseGeocode,
  snapToNearestRoad,
} from "./src/services/googleMapsService";
import { voiceAssistant } from "./src/services/voiceService";

import MapViewComponent from "./src/map/MapViewComponent";
import TopBar from "./src/components/TopBar";
import NavigationManeuverBar from "./src/components/NavigationManeuverBar";
import DestinationSearchModal from "./src/components/DestinationSearchModal";
import RoutePreviewCard from "./src/components/RoutePreviewCard";
import NavigationBottomCard from "./src/components/NavigationBottomCard";
import BottomNavSheet from "./src/components/BottomNavSheet";
import FloatingControls from "./src/components/FloatingControls";
import TelemetryModal from "./src/components/TelemetryModal";
import VoiceAssistantBar from "./src/components/VoiceAssistantBar";
import PlaceDetailsModal from "./src/components/PlaceDetailsModal";
import { LanguageProvider, useLanguage } from "./src/locales/i18n";
import TripProgressBar from "./src/components/TripProgressBar";
import CrashSOSModal from "./src/components/CrashSOSModal";
import ServerConfigModal from "./src/components/ServerConfigModal";

// ============================================================
// SIH-168 — Intelligent Vehicle Navigation (IDR + GNSS Fusion)
// Live 50Hz IMU • AI SpeedNet • 15-State ES-EKF • Google Routes
// ============================================================
// Main Application Component
function MainApp() {
  const { t, language } = useLanguage();

  const webViewRef = useRef(null);
  const rerouteDebounceTimer = useRef(null);
  const offRouteCountRef = useRef(0);

  // ----------------------------------------------------------
  // LIVE CONNECTION & TELEMETRY STATE (via custom hook)
  // ----------------------------------------------------------
  const telemetry = useVehicleTelemetry();
  const {
    connectionStatus,
    isReconnecting,
    sendMessage,
    wsRef,
    navMode, setNavMode,
    isAligned, setIsAligned,
    motionState, setMotionState,
    aiTrust, setAiTrust,
    isZuptActive, setIsZuptActive,
    speedKmh, setSpeedKmh,
    headingDeg, setHeadingDeg,
    vehiclePos, setVehiclePos,
    blackoutBanner, setBlackoutBanner,
    recoveryBanner, setRecoveryBanner,
    v2vSyncMessage,
    sosBanner,
    setOnMessage,
  } = telemetry;

  const [tripDistanceM, setTripDistanceM] = useState(0);
  const [crashDetected, setCrashDetected] = useState(false);
  const [isRolloverWarningEnabled, setIsRolloverWarningEnabled] = useState(false);
  const [isCrashWarningEnabled, setIsCrashWarningEnabled] = useState(false);
  const [rolloverAlert, setRolloverAlert] = useState(false);
  const [serverConfigVisible, setServerConfigVisible] = useState(false);

  // ----------------------------------------------------------
  // PHONE GNSS & SENSOR HARDWARE STATE
  // ----------------------------------------------------------
  const [phoneLocation, setPhoneLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isSimulatedBlackout, setIsSimulatedBlackout] = useState(false);
  const isSimulatedBlackoutRef = useRef(false);

  const [liveAccel, setLiveAccel] = useState({ x: 0, y: 0, z: 0 });
  const [liveGyro, setLiveGyro] = useState({ x: 0, y: 0, z: 0 });
  const [imuHz, setImuHz] = useState(50.0);
  const accelRef = useRef({ x: 0, y: 0, z: 0 });
  const gyroRef = useRef({ x: 0, y: 0, z: 0 });
  const imuCountRef = useRef(0);

  // ----------------------------------------------------------
  // NAVIGATION & ROUTING STATE MACHINE
  // States: 'IDLE' | 'SEARCHING' | 'ROUTE_PREVIEW' | 'NAVIGATING' | 'OFF_ROUTE' | 'REROUTING' | 'ARRIVED'
  // ----------------------------------------------------------
  const [navigationState, setNavigationState] = useState("IDLE");
  const [destination, setDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [currentManeuver, setCurrentManeuver] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [showRecenter, setShowRecenter] = useState(false);

  // Modal Visibility
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [telemetryModalVisible, setTelemetryModalVisible] = useState(false);
  const [placeDetailsVisible, setPlaceDetailsVisible] = useState(false);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState(null);

  // Voice Navigation Assistant State
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceState, setVoiceState] = useState("IDLE");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const voiceAutoCloseTimer = useRef(null);

  // Theme State (Default: Day Mode)
  const [theme, setTheme] = useState("day");

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "day" ? "night" : "day";
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "set_theme", theme: next })
      );
      return next;
    });
  }, []);

  useEffect(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({ type: "set_theme", theme })
    );
  }, [theme]);

  // Free-Drive Road Network Snapping (Active when not navigating route)
  const lastNearestQueryTime = useRef(0);
  const lastNearestQueryPos = useRef(null);

  const checkFreeDriveRoadMatch = useCallback(
    async (pos) => {
      if (!pos || navigationState === "NAVIGATING") return;
      const now = Date.now();
      if (now - lastNearestQueryTime.current < 2500) return;

      if (lastNearestQueryPos.current) {
        const d = getDistanceMeters(
          pos.lat,
          pos.lng,
          lastNearestQueryPos.current.lat,
          lastNearestQueryPos.current.lng
        );
        if (d < 6) return;
      }

      lastNearestQueryTime.current = now;
      lastNearestQueryPos.current = pos;

      try {
        const nearest = await snapToNearestRoad(pos.lat, pos.lng);
        if (nearest && nearest.lat && nearest.lng) {
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: "road_network_seed",
              lat: nearest.lat,
              lng: nearest.lng,
              name: nearest.name,
              distance: nearest.distance,
            })
          );
        }
      } catch (_) { }
    },
    [navigationState]
  );

  // (Transition banners now managed by useVehicleTelemetry hook)

  // Cumulative trip distance tracking — Displacement-verified (Zero-Drift)
  const lastMovingPosRef = useRef(null);
  useEffect(() => {
    if (speedKmh < 3.0 || !vehiclePos) {
      lastMovingPosRef.current = null;
      return;
    }

    if (!lastMovingPosRef.current) {
      lastMovingPosRef.current = vehiclePos;
      return;
    }

    const dist = getDistanceMeters(
      lastMovingPosRef.current.lat,
      lastMovingPosRef.current.lng,
      vehiclePos.lat,
      vehiclePos.lng
    );

    // Only accumulate if real displacement occurred (> 2.5m and < 120m per fix)
    if (dist >= 2.5 && dist < 120.0) {
      setTripDistanceM((prev) => prev + dist);
      lastMovingPosRef.current = vehiclePos;
    }
  }, [vehiclePos, speedKmh]);

  // Track IMU update frequency for judge metrics
  useEffect(() => {
    const hzInterval = setInterval(() => {
      setImuHz(imuCountRef.current);
      imuCountRef.current = 0;
    }, 1000);
    return () => clearInterval(hzInterval);
  }, []);

  // ----------------------------------------------------------
  // WEBSOCKET → LEAFLET BRIDGE (Forward telemetry to map WebView)
  // ----------------------------------------------------------
  useEffect(() => {
    setOnMessage((parsed) => {
      // Update DR state heading
      drStateRef.current.heading = parsed.heading;

      // Forward position to map
      if (parsed.lat && parsed.lng) {
        const pos = { lat: parsed.lat, lng: parsed.lng };
        handleVehicleMovement(pos);
        checkFreeDriveRoadMatch(pos);
      }

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "vehicle_position",
          lat: parsed.lat,
          lng: parsed.lng,
          heading: parsed.heading,
          speed: parsed.speed,
          nav_mode: parsed.navMode,
          zupt_active: parsed.zuptActive,
        })
      );
    });
  }, [setOnMessage, checkFreeDriveRoadMatch]);

  // Alias for backward compat with TopBar's "reconnect" button
  const connectWebSocket = telemetry.connect;

  // ----------------------------------------------------------
  // IMU SENSOR HARDWARE STREAMING & ON-DEVICE DEAD RECKONING (50Hz)
  // ----------------------------------------------------------
  const drStateRef = useRef({
    lat: 22.6667,
    lng: 75.8919,
    heading: 0,
    speed: 0,
    lastTime: Date.now(),
  });

  const smoothAccelRef = useRef({ x: 0, y: 0, z: 9.81 });
  const smoothGyroRef = useRef({ x: 0, y: 0, z: 0 });
  const accelWindowRef = useRef([]);
  const gyroWindowRef = useRef([]);
  const lastUiUpdateRef = useRef(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(20);
    Gyroscope.setUpdateInterval(20);

    const accelSub = Accelerometer.addListener((data) => {
      const rawX = data.x * G_TO_MS2;
      const rawY = data.y * G_TO_MS2;
      const rawZ = data.z * G_TO_MS2;

      accelWindowRef.current.push([rawX, rawY, rawZ]);
      if (accelWindowRef.current.length > 15) accelWindowRef.current.shift();

      // Crash Detection (Threshold: ~5G / 50m/s^2 for Demo)
      const magnitude = Math.sqrt(rawX ** 2 + rawY ** 2 + rawZ ** 2);
      if (magnitude > 60.0 && !crashDetected) {
        setCrashDetected(true);
      }

      // Rollover / Critical Slope Detection (>60 deg)
      if (magnitude > 1.0) {
        const tiltRad = Math.acos(Math.abs(rawZ) / magnitude);
        const tiltDeg = tiltRad * (180 / Math.PI);
        if (tiltDeg > 60.0) {
          setRolloverAlert(true);
        } else {
          setRolloverAlert(false);
        }
      }

      let isStationary = false;
      if (accelWindowRef.current.length >= 10) {
        const xs = accelWindowRef.current.map((s) => s[0]);
        const ys = accelWindowRef.current.map((s) => s[1]);
        const zs = accelWindowRef.current.map((s) => s[2]);
        const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
        const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
        const meanZ = zs.reduce((a, b) => a + b, 0) / zs.length;
        const varX = xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length;
        const varY = ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / ys.length;
        const varZ = zs.reduce((a, b) => a + (b - meanZ) ** 2, 0) / zs.length;
        const totalStd = Math.sqrt(varX + varY + varZ);
        if (totalStd < 0.35) {
          isStationary = true;
        }
      }

      if (isStationary) {
        smoothAccelRef.current = {
          x: Math.abs(smoothAccelRef.current.x) < 0.4 ? 0.0 : Math.round(smoothAccelRef.current.x * 10) / 10,
          y: Math.abs(smoothAccelRef.current.y) < 0.4 ? 0.0 : Math.round(smoothAccelRef.current.y * 10) / 10,
          z: Math.abs(smoothAccelRef.current.z - 9.81) < 0.6 ? 9.81 : Math.round(smoothAccelRef.current.z * 10) / 10,
        };
      } else {
        const alpha = 0.15;
        smoothAccelRef.current.x += (rawX - smoothAccelRef.current.x) * alpha;
        smoothAccelRef.current.y += (rawY - smoothAccelRef.current.y) * alpha;
        smoothAccelRef.current.z += (rawZ - smoothAccelRef.current.z) * alpha;
      }

      accelRef.current = {
        x: smoothAccelRef.current.x / G_TO_MS2,
        y: smoothAccelRef.current.y / G_TO_MS2,
        z: smoothAccelRef.current.z / G_TO_MS2,
      };

      const now = Date.now();
      if (now - lastUiUpdateRef.current > 120) {
        lastUiUpdateRef.current = now;
        setLiveAccel({
          x: Math.round(smoothAccelRef.current.x * 100) / 100,
          y: Math.round(smoothAccelRef.current.y * 100) / 100,
          z: Math.round(smoothAccelRef.current.z * 100) / 100,
        });
      }
    });

    const gyroSub = Gyroscope.addListener((data) => {
      gyroWindowRef.current.push([data.x, data.y, data.z]);
      if (gyroWindowRef.current.length > 15) gyroWindowRef.current.shift();

      let isStationary = false;
      if (gyroWindowRef.current.length >= 10) {
        const mag = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
        if (mag < 0.18) {
          isStationary = true;
        }
      }

      if (isStationary) {
        smoothGyroRef.current = { x: 0.0, y: 0.0, z: 0.0 };
      } else {
        const alpha = 0.25;
        smoothGyroRef.current.x += (data.x - smoothGyroRef.current.x) * alpha;
        smoothGyroRef.current.y += (data.y - smoothGyroRef.current.y) * alpha;
        smoothGyroRef.current.z += (data.z - smoothGyroRef.current.z) * alpha;
      }

      gyroRef.current = {
        x: smoothGyroRef.current.x,
        y: smoothGyroRef.current.y,
        z: smoothGyroRef.current.z,
      };

      setLiveGyro({
        x: Math.round(smoothGyroRef.current.x * 100) / 100,
        y: Math.round(smoothGyroRef.current.y * 100) / 100,
        z: Math.round(smoothGyroRef.current.z * 100) / 100,
      });
    });

    const imuLoop = setInterval(() => {
      const ws = wsRef.current;
      imuCountRef.current += 1;
      const now = Date.now();
      const dt = Math.max(0.005, Math.min(0.1, (now - drStateRef.current.lastTime) / 1000.0));
      drStateRef.current.lastTime = now;

      const accel = accelRef.current;
      const gyro = gyroRef.current;

      // 1. Forward to Backend WebSocket Server if connected
      if (ws && ws.readyState === WebSocket.OPEN) {
        const ts = now / 1000.0;
        const imuPacket = {
          type: "imu",
          timestamp: ts,
          accelerometer: [
            accel.x * G_TO_MS2,
            accel.y * G_TO_MS2,
            accel.z * G_TO_MS2,
          ],
          gyroscope: [gyro.x, gyro.y, gyro.z],
        };

        try {
          ws.send(JSON.stringify(imuPacket));
        } catch (_) { }
      }

      // 2. On-Device Inertial Mechanization
      const yawRate = Math.abs(gyro.y) > Math.abs(gyro.z) ? gyro.y : -gyro.z;
      if (Math.abs(yawRate) >= 0.15) { // Increased deadband to prevent stationary heading jitter
        const gyroDegPerSec = yawRate * (180.0 / Math.PI);
        drStateRef.current.heading = (drStateRef.current.heading + gyroDegPerSec * dt + 360) % 360;
        const currentH = Math.round(drStateRef.current.heading);
        setHeadingDeg(currentH);

        if ((!ws || ws.readyState !== WebSocket.OPEN) && drStateRef.current.lat && drStateRef.current.lng) {
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: "vehicle_position",
              lat: drStateRef.current.lat,
              lng: drStateRef.current.lng,
              heading: currentH,
              speed: drStateRef.current.speed,
              nav_mode: isSimulatedBlackoutRef.current ? "DR" : "GNSS",
            })
          );
        }
      }

      if (isSimulatedBlackoutRef.current || !ws || ws.readyState !== WebSocket.OPEN) {
        const rad = (drStateRef.current.heading * Math.PI) / 180.0;
        const speedMs = drStateRef.current.speed / 3.6;

        if (speedMs > 0.1) {
          const dLat = (speedMs * Math.cos(rad) * dt) / 111320.0;
          const dLng = (speedMs * Math.sin(rad) * dt) / (111320.0 * Math.cos((drStateRef.current.lat * Math.PI) / 180.0));
          drStateRef.current.lat += dLat;
          drStateRef.current.lng += dLng;

          const updatedPos = { lat: drStateRef.current.lat, lng: drStateRef.current.lng };
          setVehiclePos(updatedPos);
          setHeadingDeg(Math.round(drStateRef.current.heading));
          handleVehicleMovement(updatedPos);
          checkFreeDriveRoadMatch(updatedPos);

          webViewRef.current?.postMessage(
            JSON.stringify({
              type: "vehicle_position",
              lat: drStateRef.current.lat,
              lng: drStateRef.current.lng,
              heading: Math.round(drStateRef.current.heading),
              speed: drStateRef.current.speed,
              nav_mode: isSimulatedBlackoutRef.current ? "DR" : "GNSS",
            })
          );
        }

        // On-device continuous AI trust regulation (fallback when WS disconnected)
        if (accelWindowRef.current.length >= 10 && gyroWindowRef.current.length >= 10) {
          const xs = accelWindowRef.current.map((s) => s[0]);
          const ys = accelWindowRef.current.map((s) => s[1]);
          const zs = accelWindowRef.current.map((s) => s[2]);
          const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const meanY = ys.reduce((a, b) => a + b, 0) / xs.length;
          const meanZ = zs.reduce((a, b) => a + b, 0) / zs.length;
          const varX = xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length;
          const varY = ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / xs.length;
          const varZ = zs.reduce((a, b) => a + (b - meanZ) ** 2, 0) / zs.length;
          const totalAccStd = Math.sqrt(varX + varY + varZ);

          const gx = gyroWindowRef.current.map((g) => g[0]);
          const gy = gyroWindowRef.current.map((g) => g[1]);
          const transverseGyroMag = Math.sqrt(
            (gx.reduce((a, b) => a + b, 0) / gx.length) ** 2 +
            (gy.reduce((a, b) => a + b, 0) / gy.length) ** 2
          );

          let targetTrust = 1.0;
          if (totalAccStd > 2.8 || transverseGyroMag > 1.2) {
            targetTrust = 0.0;
          } else if (totalAccStd > 1.0 || transverseGyroMag > 0.3) {
            const penalty = Math.min(0.75, (totalAccStd - 1.0) * 0.25 + (transverseGyroMag - 0.3) * 0.6);
            targetTrust = Math.max(0.15, 1.0 - penalty);
          }

          setAiTrust((prev) => {
            const alpha = 0.12;
            const next = (1 - alpha) * prev + alpha * targetTrust;
            return Math.round(next * 100) / 100;
          });
        }
      }
    }, 20);

    return () => {
      accelSub?.remove();
      gyroSub?.remove();
      clearInterval(imuLoop);
    };
  }, []);

  // ----------------------------------------------------------
  // GNSS LOCATION STREAMING (1Hz)
  // ----------------------------------------------------------
  useEffect(() => {
    let locationSub = null;
    let headingSub = null;

    async function startLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[GPS] Foreground permission denied");
          return;
        }

        // 1. Continuous Hardware Magnetometer / Compass Tracking
        try {
          headingSub = await Location.watchHeadingAsync((headingData) => {
            const compHeading =
              typeof headingData.trueHeading === "number" && headingData.trueHeading >= 0
                ? headingData.trueHeading
                : headingData.magHeading;

            if (typeof compHeading === "number" && !isNaN(compHeading)) {
              const roundedHeading = Math.round(((compHeading % 360) + 360) % 360);
              drStateRef.current.compassHeading = roundedHeading;

              // Immediately update vehicle orientation for responsiveness in demo
              // (Normally EKF handles this at high speeds, but we want it instant for walking)
              const currentSpeed = drStateRef.current.speed || 0;
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || currentSpeed < 15.0) {
                setHeadingDeg(roundedHeading);
                drStateRef.current.heading = roundedHeading;

                if (drStateRef.current.lat && drStateRef.current.lng) {
                  webViewRef.current?.postMessage(
                    JSON.stringify({
                      type: "vehicle_position",
                      lat: drStateRef.current.lat,
                      lng: drStateRef.current.lng,
                      heading: roundedHeading,
                      speed: currentSpeed,
                      nav_mode: isSimulatedBlackoutRef.current ? "DR" : "GNSS",
                    })
                  );
                }
              }
            }
          });
        } catch (compassErr) {
          console.log("[Compass] Watch heading error:", compassErr);
        }

        try {
          const initialPos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (initialPos && initialPos.coords) {
            const { latitude, longitude, speed, heading, accuracy } = initialPos.coords;
            setPhoneLocation({ lat: latitude, lng: longitude });
            setVehiclePos({ lat: latitude, lng: longitude }); // Ensure V2V works even before moving
            setGpsAccuracy(accuracy);
            drStateRef.current.lat = latitude;
            drStateRef.current.lng = longitude;
            if (heading !== null && heading !== undefined && !isNaN(heading) && heading >= 0) {
              drStateRef.current.heading = heading;
              setHeadingDeg(Math.round(heading));
            }
            if (speed) drStateRef.current.speed = Math.max(0, speed * 3.6);

            webViewRef.current?.postMessage(
              JSON.stringify({
                type: "initial_location",
                lat: latitude,
                lng: longitude,
                accuracy,
              })
            );
          }
        } catch (initialErr) {
          console.log("[GPS] Initial fix err:", initialErr);
        }

        locationSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (position) => {
            const { latitude, longitude, speed, heading, accuracy } = position.coords;

            setPhoneLocation({ lat: latitude, lng: longitude });
            setGpsAccuracy(accuracy);

            if (!isSimulatedBlackoutRef.current) {
              const currentSpeedKmh = Math.max(0, speed ? speed * 3.6 : 0);
              const effectiveSpeed = currentSpeedKmh < 0.5 ? 0.0 : currentSpeedKmh;

              drStateRef.current.lat = latitude;
              drStateRef.current.lng = longitude;
              drStateRef.current.speed = effectiveSpeed;

              // Lock heading when stationary to prevent spinning
              if (heading !== null && heading !== undefined && !isNaN(heading) && heading >= 0) {
                if (effectiveSpeed >= 0.5 || drStateRef.current.heading === undefined) {
                  drStateRef.current.heading = heading;
                  setHeadingDeg(Math.round(heading));
                }
              }

              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                setSpeedKmh(effectiveSpeed);
                const pos = { lat: latitude, lng: longitude };
                setVehiclePos(pos);
                setIsAligned(true);
                setNavMode("GNSS");
                handleVehicleMovement(pos);
                checkFreeDriveRoadMatch(pos);

                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: "vehicle_position",
                    lat: latitude,
                    lng: longitude,
                    heading: drStateRef.current.heading || 0,
                    speed: effectiveSpeed,
                    nav_mode: "GNSS",
                  })
                );
              }
            }

            if (isSimulatedBlackoutRef.current) {
              return;
            }

            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              const gnssPacket = {
                type: "gnss",
                timestamp: position.timestamp
                  ? position.timestamp / 1000.0
                  : Date.now() / 1000.0,
                latitude,
                longitude,
                speed: Math.max(0, speed ?? 0),
                heading: drStateRef.current.heading ?? (heading ?? 0.0),
                accuracy: accuracy ?? 5.0,
              };

              try {
                ws.send(JSON.stringify(gnssPacket));
              } catch (_) { }
            }

            webViewRef.current?.postMessage(
              JSON.stringify({
                type: "phone_gps",
                lat: latitude,
                lng: longitude,
                accuracy,
              })
            );
          }
        );
      } catch (e) {
        console.log("[GPS] Watcher error:", e);
      }
    }

    startLocation();

    return () => {
      locationSub?.remove();
      headingSub?.remove();
    };
  }, []);

  // ----------------------------------------------------------
  // OFF-ROUTE DETECTION & NAVIGATION TRACKING
  // ----------------------------------------------------------
  const handleVehicleMovement = (pos) => {
    if (!pos || navigationState !== "NAVIGATING" || !routeInfo?.coordinates) return;

    // 1. Check if arrived at destination (< 25 meters)
    if (destination?.lat && destination?.lng) {
      const distToDest = getDistanceMeters(pos.lat, pos.lng, destination.lat, destination.lng);
      if (distToDest < 25) {
        setNavigationState("ARRIVED");
        voiceAssistant.checkArrivalAnnouncement();
        Alert.alert("Destination Reached", "You have arrived at your destination! 🏁", [
          { text: "OK", onPress: handleExitNavigation },
        ]);
        return;
      }
    }

    // 2. Off-Route Detection (Minimum distance to route > 45 meters)
    const isOff = isOffRoute(pos, routeInfo.coordinates, 45);
    if (isOff) {
      offRouteCountRef.current += 1;
      // Debounce: trigger reroute if off-route for 3 consecutive updates
      if (offRouteCountRef.current >= 3 && navigationState !== "REROUTING") {
        setNavigationState("OFF_ROUTE");
        triggerReroute(pos);
      }
    } else {
      offRouteCountRef.current = 0;
      if (navigationState === "OFF_ROUTE") {
        setNavigationState("NAVIGATING");
      }
    }

    // 3. Smart Voice Turn-by-Turn Maneuver Guidance (Event-based, throttled)
    if (routeInfo?.steps && routeInfo.steps.length > 0) {
      const step = currentManeuver || routeInfo.steps[0];
      const stepIdx = routeInfo.steps.indexOf(step);
      const stepDist = step.distanceMeters || 300;
      voiceAssistant.checkManeuverAnnouncement(step, stepIdx >= 0 ? stepIdx : 0, stepDist);
    }
  };

  // Voice Announcements for GNSS Outage / Recovery Transitions (Disabled by request)
  // useEffect(() => {
  //   voiceAssistant.checkGnssTransitionAnnouncement(navMode, isSimulatedBlackout);
  // }, [navMode, isSimulatedBlackout]);

  // Voice Announcements for Off-Route State
  useEffect(() => {
    voiceAssistant.checkOffRouteAnnouncement(navigationState);
  }, [navigationState]);

  const triggerReroute = (startPos) => {
    if (rerouteDebounceTimer.current) clearTimeout(rerouteDebounceTimer.current);

    rerouteDebounceTimer.current = setTimeout(async () => {
      if (!destination || !startPos) return;
      try {
        setNavigationState("REROUTING");
        const newRoute = await getRoute(startPos, destination, language);
        setRouteInfo(newRoute);
        setCurrentManeuver(newRoute.initialManeuver);
        offRouteCountRef.current = 0;
        setNavigationState("NAVIGATING");

        webViewRef.current?.postMessage(
          JSON.stringify({
            type: "draw_route",
            coordinates: newRoute.coordinates,
            destLat: destination.lat,
            destLng: destination.lng,
            fitBounds: false,
          })
        );
      } catch (e) {
        console.log("[Reroute] Error calculating reroute:", e);
      }
    }, 1500);
  };

  // ----------------------------------------------------------
  // ROUTING & DESTINATION CONTROLS
  // ----------------------------------------------------------
  const calculateRouteToDestination = async (destObj) => {
    const start = vehiclePos || phoneLocation || { lat: 22.6667, lng: 75.8919 };
    if (!start) {
      Alert.alert("GPS Required", "Waiting for GPS position to calculate route...");
      return;
    }

    setIsRouting(true);
    setDestination(destObj);

    try {
      const calculatedRoute = await getRoute(start, destObj, language);
      setRouteInfo(calculatedRoute);
      setCurrentManeuver(calculatedRoute.initialManeuver);
      setNavigationState("ROUTE_PREVIEW");

      // Draw route on map
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "draw_route",
          coordinates: calculatedRoute.coordinates,
          destLat: destObj.lat,
          destLng: destObj.lng,
          fitBounds: true,
        })
      );
    } catch (e) {
      console.log("[Route] Fetch error:", e);
      Alert.alert("Route Error", "Could not compute route to this location. Please try another place.");
      setNavigationState("IDLE");
    } finally {
      setIsRouting(false);
    }
  };

  const handleSelectDestination = (destObj) => {
    setSearchModalVisible(false);
    calculateRouteToDestination(destObj);
  };

  const handleStartNavigation = () => {
    setNavigationState("NAVIGATING");
    setShowRecenter(false);

    // Notify map to lock camera following
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "set_navigation_state",
        isNavigating: true,
      })
    );
  };

  const handleExitNavigation = () => {
    voiceAssistant.stop();
    setNavigationState("IDLE");
    setDestination(null);
    setRouteInfo(null);
    setCurrentManeuver(null);
    setShowRecenter(false);

    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "set_navigation_state",
        isNavigating: false,
      })
    );
    webViewRef.current?.postMessage(JSON.stringify({ type: "clear_route" }));
  };

  // ----------------------------------------------------------
  // VOICE NAVIGATION ASSISTANT HANDLERS
  // ----------------------------------------------------------
  const handleOpenVoice = () => {
    if (voiceAutoCloseTimer.current) clearTimeout(voiceAutoCloseTimer.current);
    setVoiceVisible(true);
    setVoiceState("LISTENING");
    setVoiceTranscript("");
    setVoiceFeedback("");
  };

  const handleCloseVoice = () => {
    if (voiceAutoCloseTimer.current) clearTimeout(voiceAutoCloseTimer.current);
    setVoiceVisible(false);
    setVoiceState("IDLE");
    voiceAssistant.stop();
  };

  const handleProcessVoiceCommand = async (cmdText) => {
    if (!cmdText) return;
    if (voiceAutoCloseTimer.current) clearTimeout(voiceAutoCloseTimer.current);

    setVoiceTranscript(cmdText);
    setVoiceState("PROCESSING");

    const intent = voiceAssistant.parseVoiceIntent(cmdText);

    switch (intent.type) {
      case "DESTINATION_SEARCH": {
        setVoiceFeedback(`Searching for "${intent.query}"...`);
        const start = vehiclePos || phoneLocation || { lat: 22.6667, lng: 75.8919 };
        const results = await searchPlaces(intent.query, start.lat, start.lng);

        if (results && results.length > 0) {
          const topResult = results[0];
          setVoiceFeedback(`Calculating route to ${topResult.title}...`);
          try {
            const calculatedRoute = await getRoute(start, topResult, language);
            setDestination(topResult);
            setRouteInfo(calculatedRoute);
            setCurrentManeuver(calculatedRoute.initialManeuver);
            setNavigationState("ROUTE_PREVIEW");

            webViewRef.current?.postMessage(
              JSON.stringify({
                type: "draw_route",
                coordinates: calculatedRoute.coordinates,
                destLat: topResult.lat,
                destLng: topResult.lng,
                fitBounds: true,
              })
            );

            const distKm = (calculatedRoute.distanceMeters / 1000).toFixed(1);
            const durationMins = Math.max(1, Math.round(calculatedRoute.durationSeconds / 60));
            const voiceMsg = `Route found to ${topResult.title}. ${distKm} kilometers, about ${durationMins} minutes.`;

            setVoiceState("SPEAKING");
            setVoiceFeedback(voiceMsg);
            await voiceAssistant.speak(voiceMsg);

            voiceAutoCloseTimer.current = setTimeout(() => {
              setVoiceVisible(false);
              setVoiceState("IDLE");
            }, 5000);
          } catch (routeErr) {
            const errMsg = "Could not compute route to this location. Please try another place.";
            setVoiceState("ERROR");
            setVoiceFeedback(errMsg);
            await voiceAssistant.speak(errMsg);
          }
        } else {
          const notFound = `Sorry, couldn't find a place matching "${intent.query}".`;
          setVoiceState("ERROR");
          setVoiceFeedback(notFound);
          await voiceAssistant.speak(notFound);
        }
        break;
      }

      case "START_NAVIGATION": {
        if (navigationState === "ROUTE_PREVIEW" || routeInfo) {
          handleStartNavigation();
          const destName = destination?.title || destination?.name || "destination";
          const startMsg = `Starting navigation to ${destName}.`;
          setVoiceState("SPEAKING");
          setVoiceFeedback(startMsg);
          await voiceAssistant.speak(startMsg);
          voiceAutoCloseTimer.current = setTimeout(() => handleCloseVoice(), 2400);
        } else {
          const noRouteMsg = "Please search for a destination first.";
          setVoiceState("ERROR");
          setVoiceFeedback(noRouteMsg);
          await voiceAssistant.speak(noRouteMsg);
        }
        break;
      }

      case "STOP_NAVIGATION": {
        if (
          navigationState === "NAVIGATING" ||
          navigationState === "ROUTE_PREVIEW" ||
          navigationState === "OFF_ROUTE" ||
          navigationState === "REROUTING"
        ) {
          handleExitNavigation();
          const stopMsg = "Navigation stopped.";
          setVoiceState("SPEAKING");
          setVoiceFeedback(stopMsg);
          await voiceAssistant.speak(stopMsg);
          voiceAutoCloseTimer.current = setTimeout(() => handleCloseVoice(), 2200);
        } else {
          const noActiveMsg = "There isn't an active route right now.";
          setVoiceState("ERROR");
          setVoiceFeedback(noActiveMsg);
          await voiceAssistant.speak(noActiveMsg);
        }
        break;
      }

      case "RECENTER": {
        handleRecenter();
        const recenterMsg = "Recentered on your location.";
        setVoiceState("SPEAKING");
        setVoiceFeedback(recenterMsg);
        await voiceAssistant.speak(recenterMsg);
        voiceAutoCloseTimer.current = setTimeout(() => handleCloseVoice(), 2200);
        break;
      }

      case "QUERY_SPEED": {
        const spd = Math.round(speedKmh);
        const speedMsg = `You're traveling at ${spd} kilometers per hour.`;
        setVoiceState("SPEAKING");
        setVoiceFeedback(speedMsg);
        await voiceAssistant.speak(speedMsg);
        break;
      }

      case "QUERY_POSITION":
      case "QUERY_LOCATION": {
        const currentPos = vehiclePos || phoneLocation;
        if (currentPos && currentPos.lat && currentPos.lng) {
          setVoiceFeedback("Identifying current area...");
          const place = await reverseGeocode(currentPos.lat, currentPos.lng);
          const locMsg = place
            ? `You're near ${place}.`
            : "Your current position is available, but the street name is unlisted.";
          setVoiceState("SPEAKING");
          setVoiceFeedback(locMsg);
          await voiceAssistant.speak(locMsg);
        } else {
          const noGps = "Waiting for GPS position fix.";
          setVoiceState("ERROR");
          setVoiceFeedback(noGps);
          await voiceAssistant.speak(noGps);
        }
        break;
      }

      case "QUERY_DISTANCE": {
        if (routeInfo && typeof routeInfo.distanceMeters === "number") {
          const distStr = formatDistance(routeInfo.distanceMeters);
          const distMsg = `The destination is ${distStr} away.`;
          setVoiceState("SPEAKING");
          setVoiceFeedback(distMsg);
          await voiceAssistant.speak(distMsg);
        } else {
          const noRouteMsg = "There isn't an active route right now.";
          setVoiceState("ERROR");
          setVoiceFeedback(noRouteMsg);
          await voiceAssistant.speak(noRouteMsg);
        }
        break;
      }

      case "QUERY_ETA": {
        if (routeInfo && typeof routeInfo.durationSeconds === "number") {
          const durStr = formatDuration(routeInfo.durationSeconds);
          const etaStr = routeInfo.etaTime || calculateEtaTime(routeInfo.durationSeconds);
          const etaMsg = `It will take approximately ${durStr}, arriving around ${etaStr}.`;
          setVoiceState("SPEAKING");
          setVoiceFeedback(etaMsg);
          await voiceAssistant.speak(etaMsg);
        } else {
          const noRouteMsg = "There isn't an active route right now.";
          setVoiceState("ERROR");
          setVoiceFeedback(noRouteMsg);
          await voiceAssistant.speak(noRouteMsg);
        }
        break;
      }

      case "QUERY_NEXT_MANEUVER": {
        if (currentManeuver) {
          const distStr = currentManeuver.formattedDistance;
          const turnMsg = distStr
            ? `In ${distStr}, ${currentManeuver.instruction}.`
            : `${currentManeuver.instruction}.`;
          setVoiceState("SPEAKING");
          setVoiceFeedback(turnMsg);
          await voiceAssistant.speak(turnMsg);
        } else {
          const noTurnMsg = "There are no upcoming maneuvers right now.";
          setVoiceState("ERROR");
          setVoiceFeedback(noTurnMsg);
          await voiceAssistant.speak(noTurnMsg);
        }
        break;
      }

      default: {
        const unknownMsg = "Didn't catch that. Try again.";
        setVoiceState("ERROR");
        setVoiceFeedback(unknownMsg);
        await voiceAssistant.speak(unknownMsg);
        break;
      }
    }
  };

  // ----------------------------------------------------------
  // MAP CONTROLS & CAMERA RECENTER
  // ----------------------------------------------------------
  const handleRecenter = () => {
    setShowRecenter(false);
    const target = vehiclePos || phoneLocation;
    if (target) {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "recenter",
          lat: target.lat,
          lng: target.lng,
        })
      );
    }
  };

  const handleZoomIn = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "zoom_in" }));
  };

  const handleZoomOut = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "zoom_out" }));
  };

  const toggleBlackoutSimulation = () => {
    const nextState = !isSimulatedBlackout;
    setIsSimulatedBlackout(nextState);
    isSimulatedBlackoutRef.current = nextState;

    const newMode = nextState ? "DR" : "GNSS";
    if (nextState) {
      setBlackoutBanner(true);
      setRecoveryBanner(false);
      setNavMode("DR");
    } else {
      setRecoveryBanner(true);
      setBlackoutBanner(false);
      setNavMode("GNSS");
    }

    const pos = vehiclePos || phoneLocation || (drStateRef.current.lat ? drStateRef.current : null);
    if (pos && pos.lat && pos.lng) {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "vehicle_position",
          lat: pos.lat,
          lng: pos.lng,
          heading: headingDeg,
          speed: speedKmh,
          nav_mode: newMode,
        })
      );
    }
  };

  const handleClearTrail = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "clear_trail" }));
    setTripDistanceM(0);
    lastMovingPosRef.current = null;
  }, []);

  return (
    <SafeAreaProvider>
      <View style={[styles.rootContainer, theme === "day" && { backgroundColor: "#E8EAED" }]}>
        <StatusBar
          barStyle={theme === "day" ? "dark-content" : "light-content"}
          backgroundColor={theme === "day" ? "#FFFFFF" : "#0c1017"}
          translucent={false}
        />

        {/* 1. Full-Screen Google Maps Viewport */}
        <MapViewComponent
          webViewRef={webViewRef}
          theme={theme}
          phoneLocation={phoneLocation}
          vehiclePos={vehiclePos}
          isRouting={isRouting}
          onMapClicked={(lat, lng) => {
            setSelectedPlaceDetails({
              name: "Pinned Location",
              vicinity: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              geometry: { location: { lat, lng } },
              lat,
              lng,
            });
            setPlaceDetailsVisible(true);
          }}
          onUserPannedMap={() => setShowRecenter(true)}
        />

        {/* Emergency SOS Modal (Sender) */}
        <CrashSOSModal
          visible={isCrashWarningEnabled && crashDetected}
          onCancel={() => setCrashDetected(false)}
          onBroadcastSOS={() => {
            setCrashDetected(false);
            if (global.broadcastV2VAnchor) global.broadcastV2VAnchor(true); // isSos = true
          }}
        />

        {/* Server Config Modal */}
        <ServerConfigModal
          visible={serverConfigVisible}
          onClose={() => setServerConfigVisible(false)}
          onUrlUpdated={(newUrl) => {
            if (telemetry.connect) {
              telemetry.connect(); // Force reconnect
            }
          }}
        />

        {/* 2. Top Area: Maneuver HUD (Navigating) OR Search Bar (Idle) */}
        {navigationState === "NAVIGATING" ||
          navigationState === "OFF_ROUTE" ||
          navigationState === "REROUTING" ? (
          <NavigationManeuverBar
            currentManeuver={currentManeuver}
            nextManeuver={routeInfo?.steps?.[1] || null}
            isOffRouteState={navigationState === "OFF_ROUTE"}
            isRerouting={navigationState === "REROUTING"}
            onExitNavigation={handleExitNavigation}
          />
        ) : (
          <TopBar
            theme={theme}
            onOpenSearch={() => setSearchModalVisible(true)}
            onOpenVoice={handleOpenVoice}
            connectionStatus={connectionStatus}
            isReconnecting={isReconnecting}
            onConnectWebSocket={connectWebSocket}
            blackoutBanner={blackoutBanner}
            recoveryBanner={recoveryBanner}
          />
        )}

        {/* 2.5 V2V Sync Banner Overlay */}
        {v2vSyncMessage && (
          <View style={styles.v2vBanner}>
            <Text style={styles.v2vBannerText}>{v2vSyncMessage}</Text>
          </View>
        )}

        {/* 2.6 Emergency SOS Receiver Banner */}
        {sosBanner && (
          <View style={styles.sosBanner}>
            <Text style={styles.sosBannerText}>⚠️ SOS: CRASH DETECTED AHEAD</Text>
          </View>
        )}

        {/* 2.7 Rollover / Critical Slope Alert */}
        {isRolloverWarningEnabled && rolloverAlert && (
          <View style={styles.rolloverBanner}>
            <Text style={styles.rolloverBannerText}>⚠️ CRITICAL SLOPE: ROLLOVER DANGER</Text>
          </View>
        )}

        {/* Vertical Trip Progress Bar on the Left (Google Maps Signature Progress) */}
        <TripProgressBar
          progress={
            routeInfo?.distanceMeters && tripDistanceM
              ? Math.min(0.92, Math.max(0.08, tripDistanceM / routeInfo.distanceMeters))
              : 0.25
          }
          isNavigating={
            navigationState === "NAVIGATING" ||
            navigationState === "OFF_ROUTE" ||
            navigationState === "REROUTING"
          }
        />

        {/* 3. Floating Right Action Controls */}
        <FloatingControls
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onClearTrail={handleClearTrail}
          isNavigating={
            navigationState === "NAVIGATING" ||
            navigationState === "OFF_ROUTE" ||
            navigationState === "REROUTING"
          }
          showRecenter={showRecenter}
          isSimulatedBlackout={isSimulatedBlackout}
          onToggleBlackout={toggleBlackoutSimulation}
          onOpenTelemetry={() => setTelemetryModalVisible(true)}
          onOpenVoice={handleOpenVoice}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRecenter={handleRecenter}
          isRolloverWarningEnabled={isRolloverWarningEnabled}
          onToggleRolloverWarning={() => setIsRolloverWarningEnabled(!isRolloverWarningEnabled)}
          isCrashWarningEnabled={isCrashWarningEnabled}
          onToggleCrashWarning={() => setIsCrashWarningEnabled(!isCrashWarningEnabled)}
          onOpenServerConfig={() => setServerConfigVisible(true)}
        />

        {/* 4. Bottom Area: Route Preview Card OR Active Nav Bottom Card OR Idle Sheet */}
        {navigationState === "ROUTE_PREVIEW" ? (
          <RoutePreviewCard
            destination={destination}
            routeInfo={routeInfo}
            onStartNavigation={handleStartNavigation}
            onCancel={handleExitNavigation}
          />
        ) : navigationState === "NAVIGATING" ||
          navigationState === "OFF_ROUTE" ||
          navigationState === "REROUTING" ? (
          <NavigationBottomCard
            theme={theme}
            routeInfo={routeInfo}
            speedKmh={speedKmh}
            navMode={navMode}
            connectionStatus={connectionStatus}
            isAligned={isAligned}
            isSimulatedBlackout={isSimulatedBlackout}
            onExitNavigation={handleExitNavigation}
            onRecenter={handleRecenter}
            showRecenter={showRecenter}
          />
        ) : (
          <BottomNavSheet
            theme={theme}
            connectionStatus={connectionStatus}
            isAligned={isAligned}
            navMode={navMode}
            motionState={motionState}
            aiTrust={aiTrust}
            isZuptActive={isZuptActive}
            speedKmh={speedKmh}
            headingDeg={headingDeg}
            tripDistanceM={tripDistanceM}
            gpsAccuracy={gpsAccuracy}
            routeInfo={routeInfo}
            destination={destination}
            vehiclePos={vehiclePos}
            phoneLocation={phoneLocation}
            liveAccel={liveAccel}
            liveGyro={liveGyro}
            isSimulatedBlackout={isSimulatedBlackout}
            onOpenTelemetry={() => setTelemetryModalVisible(true)}
            onResetTrip={() => setTripDistanceM(0)}
          />
        )}

        {/* 5. Destination Search Modal ("Where to?") */}
        <DestinationSearchModal
          visible={searchModalVisible}
          onClose={() => setSearchModalVisible(false)}
          onSelectDestination={handleSelectDestination}
          userLocation={vehiclePos || phoneLocation}
        />

        {/* 6. Judge IMU & AI Telemetry Modal */}
        <TelemetryModal
          visible={telemetryModalVisible}
          onClose={() => setTelemetryModalVisible(false)}
          imuHz={imuHz}
          liveAccel={liveAccel}
          liveGyro={liveGyro}
          aiTrust={aiTrust}
          motionState={motionState}
          isZuptActive={isZuptActive}
          isSimulatedBlackout={isSimulatedBlackout}
          onToggleBlackout={toggleBlackoutSimulation}
        />

        {/* 7. Voice Navigation Assistant Interaction Bar */}
        <VoiceAssistantBar
          visible={voiceVisible}
          onClose={handleCloseVoice}
          onProcessCommand={handleProcessVoiceCommand}
          voiceState={voiceState}
          transcriptText={voiceTranscript}
          responseFeedback={voiceFeedback}
        />

        {/* 8. Google Maps Official Place Details Card */}
        <PlaceDetailsModal
          visible={placeDetailsVisible}
          place={selectedPlaceDetails}
          onClose={() => {
            setPlaceDetailsVisible(false);
            setSelectedPlaceDetails(null);
          }}
          onStartRoute={(place) => {
            setPlaceDetailsVisible(false);
            calculateRouteToDestination(place);
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
