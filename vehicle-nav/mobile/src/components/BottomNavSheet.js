import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { styles } from "../styles/appStyles";
import { useLanguage } from "../locales/i18n";
import {
  getNavStatus,
  getSensorIntegrity,
  getCardinalHeading,
  formatDistance,
} from "../utils/formatters";

// ============================================================
// SIH-168 — Collapsible Bottom Navigation Sheet Component
// Tap to lower down (collapse) & tap to bring back up (expand)
// ============================================================

export default function BottomNavSheet({
  theme = "day",
  connectionStatus,
  isAligned,
  navMode,
  motionState,
  aiTrust,
  isZuptActive,
  speedKmh,
  headingDeg,
  tripDistanceM,
  gpsAccuracy,
  routeInfo,
  destination,
  vehiclePos,
  phoneLocation,
  liveAccel,
  liveGyro,
  isSimulatedBlackout,
  onOpenTelemetry,
  onResetTrip,
}) {
  const isDay = theme === "day";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLanguage();

  const navStatus = getNavStatus(
    connectionStatus,
    isAligned,
    navMode,
    isSimulatedBlackout
  );
  const sensorIntegrity = getSensorIntegrity(motionState, isZuptActive);

  return (
    <View style={styles.bottomSheetWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.bottomSheet,
          isDay && {
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            borderColor: "rgba(218, 220, 224, 0.95)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.14,
            shadowRadius: 10,
          },
          isCollapsed && { paddingBottom: 10, paddingTop: 6 },
        ]}
      >
        {/* Tap-to-Toggle Handle Bar */}
        <TouchableOpacity
          style={localStyles.handleTouchArea}
          onPress={() => setIsCollapsed((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.sheetHandle,
              isDay && { backgroundColor: "rgba(189, 193, 198, 0.9)" },
            ]}
          />
          <Text
            style={[
              localStyles.collapseHintText,
              { color: isDay ? "#5F6368" : "#94A3B8" },
            ]}
          >
            {isCollapsed ? "▲ Tap to expand panel" : "▼ Tap to lower panel"}
          </Text>
        </TouchableOpacity>

        {/* MINIMIZED / COLLAPSED MINI-BAR */}
        {isCollapsed ? (
          <TouchableOpacity
            style={localStyles.miniRow}
            onPress={() => setIsCollapsed(false)}
            activeOpacity={0.8}
          >
            {/* Speed */}
            <View style={localStyles.miniSpeedBlock}>
              <Text
                style={[
                  localStyles.miniSpeedValue,
                  { color: isDay ? "#202124" : "#FFFFFF" },
                ]}
              >
                {speedKmh.toFixed(1)}
              </Text>
              <Text
                style={[
                  localStyles.miniSpeedUnit,
                  { color: isDay ? "#5F6368" : "#94A3B8" },
                ]}
              >
                km/h
              </Text>
            </View>

            {/* Mode & GPS */}
            <View
              style={[
                styles.navModeBadge,
                {
                  backgroundColor: navStatus.bg,
                  borderColor: navStatus.color,
                  marginHorizontal: 8,
                },
              ]}
            >
              <View
                style={[styles.navModeDot, { backgroundColor: navStatus.dot }]}
              />
              <Text style={[styles.navModeText, { color: navStatus.color }]}>
                {navMode === "DR" || isSimulatedBlackout
                  ? t("AI-DR Active")
                  : t(navStatus.badge)}
              </Text>
            </View>

            {/* Heading */}
            <Text
              style={[
                localStyles.miniHeadingText,
                { color: isDay ? "#3C4043" : "#CBD5E1" },
              ]}
            >
              {Math.round(((headingDeg % 360) + 360) % 360)}°{" "}
              {getCardinalHeading(headingDeg)}
            </Text>
          </TouchableOpacity>
        ) : (
          /* FULL EXPANDED VIEW */
          <>
            {/* Status Header */}
            <View style={styles.sheetStatusRow}>
              <View
                style={[
                  styles.navModeBadge,
                  {
                    backgroundColor: navStatus.bg,
                    borderColor: navStatus.color,
                  },
                ]}
              >
                <View
                  style={[styles.navModeDot, { backgroundColor: navStatus.dot }]}
                />
                <Text style={[styles.navModeText, { color: navStatus.color }]}>
                  {navStatus.badge}
                </Text>
              </View>

              {navMode === "DR" || isSimulatedBlackout ? (
                <View style={styles.aiTrustBadge}>
                  <Text style={styles.aiTrustLabel}>AI TRUST</Text>
                  <Text
                    style={[
                      styles.aiTrustValue,
                      {
                        color:
                          aiTrust >= 0.75
                            ? "#10b981"
                            : aiTrust >= 0.45
                            ? "#f59e0b"
                            : "#ef4444",
                      },
                    ]}
                  >
                    {Math.round(aiTrust * 100)}%
                  </Text>
                </View>
              ) : (
                <View style={styles.sensorStatusBadge}>
                  <Text
                    style={[
                      styles.sensorStatusText,
                      { color: sensorIntegrity.color },
                    ]}
                  >
                    {t(sensorIntegrity.text)}
                  </Text>
                </View>
              )}
            </View>

            {/* Driving Metrics */}
            <View
              style={[
                styles.metricsGrid,
                isDay && {
                  backgroundColor: "rgba(241, 243, 244, 0.95)",
                  borderColor: "rgba(218, 220, 224, 0.9)",
                },
              ]}
            >
              {/* Speed */}
              <View style={styles.speedBlock}>
                <Text
                  style={[
                    styles.speedDigits,
                    isDay && { color: "#202124" },
                  ]}
                >
                  {speedKmh.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.speedUnitLabel,
                    isDay && { color: "#5F6368" },
                  ]}
                >
                  km/h
                </Text>
              </View>

              <View
                style={[
                  styles.verticalSeparator,
                  isDay && { backgroundColor: "rgba(218, 220, 224, 0.9)" },
                ]}
              />

              {/* Route ETA or Heading */}
              {routeInfo ? (
                <>
                  <View style={styles.metricItem}>
                    <Text
                      style={[
                        styles.metricLabel,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      ETA
                    </Text>
                    <Text
                      style={[
                        styles.metricValuePrimary,
                        isDay && { color: "#188038" },
                      ]}
                    >
                      {routeInfo.durationMin}{" "}
                      <Text style={{ fontSize: 11, fontWeight: "600" }}>min</Text>
                    </Text>
                    <Text
                      style={[
                        styles.metricValueSecondary,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      {routeInfo.distanceKm} km
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.verticalSeparator,
                      isDay && { backgroundColor: "rgba(218, 220, 224, 0.9)" },
                    ]}
                  />

                  <View style={styles.metricItem}>
                    <Text
                      style={[
                        styles.metricLabel,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      HEADING
                    </Text>
                    <Text
                      style={[
                        styles.metricValuePrimary,
                        isDay && { color: "#202124" },
                      ]}
                    >
                      {Math.round(((headingDeg % 360) + 360) % 360)}°
                    </Text>
                    <Text
                      style={[
                        styles.metricValueSecondary,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      {getCardinalHeading(headingDeg)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.metricItem}>
                    <Text
                      style={[
                        styles.metricLabel,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      HEADING
                    </Text>
                    <Text
                      style={[
                        styles.metricValuePrimary,
                        isDay && { color: "#202124" },
                      ]}
                    >
                      {Math.round(((headingDeg % 360) + 360) % 360)
                        .toString()
                        .padStart(3, "0")}
                      °
                    </Text>
                    <Text
                      style={[
                        styles.metricValueSecondary,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      {getCardinalHeading(headingDeg)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.verticalSeparator,
                      isDay && { backgroundColor: "rgba(218, 220, 224, 0.9)" },
                    ]}
                  />

                  <TouchableOpacity
                    style={styles.metricItem}
                    onPress={onResetTrip}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.metricLabel,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      TRIP
                    </Text>
                    <Text
                      style={[
                        styles.metricValuePrimary,
                        isDay && { color: "#202124" },
                      ]}
                    >
                      {formatDistance(tripDistanceM)}
                    </Text>
                    <Text
                      style={[
                        styles.metricValueSecondary,
                        isDay && { color: "#5F6368" },
                      ]}
                    >
                      {gpsAccuracy ? `±${gpsAccuracy.toFixed(1)}m` : "GNSS"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Quick Live IMU Strip */}
            <TouchableOpacity
              style={[
                styles.liveImuStrip,
                isDay && {
                  backgroundColor: "rgba(241, 243, 244, 0.92)",
                  borderColor: "rgba(218, 220, 224, 0.95)",
                },
              ]}
              onPress={onOpenTelemetry}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.imuStripLabel,
                  isDay && { color: "#1A73E8" },
                ]}
              >
                IMU 50Hz
              </Text>
              <Text
                style={[
                  styles.imuStripValues,
                  isDay && { color: "#3C4043" },
                ]}
              >
                Ax: {liveAccel.x.toFixed(2)} | Ay: {liveAccel.y.toFixed(2)} | Gz:{" "}
                {liveGyro.z.toFixed(2)} rad/s
              </Text>
              <Text
                style={[
                  styles.imuStripMore,
                  isDay && { color: "#1A73E8" },
                ]}
              >
                Details ➔
              </Text>
            </TouchableOpacity>

            {/* Footer Row */}
            <View style={styles.sheetFooterRow}>
              <Text
                style={[
                  styles.footerCoords,
                  isDay && { color: "#5F6368" },
                ]}
                numberOfLines={1}
              >
                {destination
                  ? `To: ${destination.name || destination.title || "Destination"}`
                  : vehiclePos
                  ? `${vehiclePos.lat.toFixed(4)}, ${vehiclePos.lng.toFixed(4)}`
                  : phoneLocation
                  ? `${phoneLocation.lat.toFixed(4)}, ${phoneLocation.lng.toFixed(4)}`
                  : "Awaiting Fix"}
              </Text>

              <View style={styles.footerRightGroup}>
                <Text
                  style={[
                    styles.footerBackendInfo,
                    isDay && { color: "#5F6368" },
                  ]}
                >
                  15-State ES-EKF · 50Hz
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  handleTouchArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  collapseHintText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 3,
    marginBottom: 4,
  },
  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniSpeedBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  miniSpeedValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  miniSpeedUnit: {
    fontSize: 10,
    fontWeight: "700",
  },
  miniHeadingText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
