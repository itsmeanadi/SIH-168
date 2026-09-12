// ============================================================
// SIH-168 — Telemetry & Navigation Formatters
// ============================================================

export const getNavStatus = (connectionStatus, isAligned, navMode, isSimulatedBlackout) => {
  if (connectionStatus !== "CONNECTED") {
    return {
      badge: "OFFLINE",
      subtext: "Reconnecting to telemetry service...",
      color: "#EF4444",
      bg: "rgba(239, 68, 68, 0.15)",
      dot: "#EF4444",
    };
  }
  if (!isAligned) {
    return {
      badge: "ALIGNING SENSORS",
      subtext: "Drive forward (> 3 m/s) to lock heading",
      color: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.15)",
      dot: "#F59E0B",
    };
  }
  if (navMode === "DR" || isSimulatedBlackout) {
    return {
      badge: "GNSS BLACKOUT (DR)",
      subtext: "GNSS lost · AI + 15-State ES-EKF Fusion Active",
      color: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.18)",
      dot: "#F59E0B",
    };
  }
  if (navMode === "RECOVERY") {
    return {
      badge: "GNSS RECOVERY",
      subtext: "Handover fusion relocked with satellite fix",
      color: "#10B981",
      bg: "rgba(16, 185, 129, 0.15)",
      dot: "#10B981",
    };
  }
  return {
    badge: "GNSS AVAILABLE (INS)",
    subtext: "High-precision GNSS + INS fusion lock",
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.15)",
    dot: "#10B981",
  };
};

export const getSensorIntegrity = (motionState, isZuptActive) => {
  if (motionState === "HARD_SHAKE" || motionState === "SENSOR_PROTECTED") {
    return { text: "Sensor Protected", color: "#F59E0B" };
  }
  if (motionState === "HIGH_DYNAMICS") {
    return { text: "High Dynamics", color: "#38BDF8" };
  }
  if (isZuptActive) {
    return { text: "Stationary (ZUPT)", color: "#10B981" };
  }
  return { text: "Sensors Normal", color: "#94A3B8" };
};

export const getCardinalHeading = (deg) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return dirs[index];
};

export const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};
