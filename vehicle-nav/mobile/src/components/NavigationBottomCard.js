import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { getNavStatus } from "../utils/formatters";

// ============================================================
// SIH-168 — Official Google Maps Active Navigation Bottom HUD
// White Card with Green Duration, RE-CENTER Pill & Report FAB
// ============================================================

export default function NavigationBottomCard({
  theme = "day",
  routeInfo,
  speedKmh = 0,
  navMode,
  connectionStatus,
  isAligned,
  isSimulatedBlackout,
  onExitNavigation,
  onRecenter,
  showRecenter,
}) {
  const isDay = theme === "day";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navStatus = getNavStatus(
    connectionStatus,
    isAligned,
    navMode,
    isSimulatedBlackout
  );

  const durationStr = routeInfo?.formattedDuration || `${routeInfo?.durationMin || 5} min`;
  const distanceStr = routeInfo?.formattedDistance || `${routeInfo?.distanceKm || 1.2} km`;
  const etaStr = routeInfo?.etaTime || "4:15 PM";

  return (
    <View style={navBottomStyles.wrapper} pointerEvents="box-none">
      {/* Floating Buttons Row Above Bottom Card */}
      <View style={navBottomStyles.floatingPillRow} pointerEvents="box-none">
        {/* Google Maps ▲ RE-CENTER Pill Button */}
        <TouchableOpacity
          style={navBottomStyles.recenterPill}
          onPress={onRecenter}
          activeOpacity={0.8}
        >
          <Text style={navBottomStyles.recenterArrow}>▲</Text>
          <Text style={navBottomStyles.recenterText}>RE-CENTER</Text>
        </TouchableOpacity>

        {/* Google Maps ⚠️ Report Pill Button */}
        <TouchableOpacity
          style={navBottomStyles.reportPill}
          onPress={() => {}}
          activeOpacity={0.8}
        >
          <Text style={navBottomStyles.reportIcon}>⚠️</Text>
          <Text style={navBottomStyles.reportText}>Report</Text>
        </TouchableOpacity>
      </View>

      {/* Main Google Maps Bottom Navigation Card */}
      <View
        style={[
          navBottomStyles.card,
          isDay ? navBottomStyles.cardDay : navBottomStyles.cardNight,
          isCollapsed && { paddingVertical: 10 },
        ]}
      >
        {/* Drag / Collapse Handle Bar */}
        <TouchableOpacity
          style={navBottomStyles.collapseHandle}
          onPress={() => setIsCollapsed((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View
            style={[
              navBottomStyles.handleBar,
              isDay && { backgroundColor: "rgba(189, 193, 198, 0.9)" },
            ]}
          />
        </TouchableOpacity>

        <View style={navBottomStyles.mainRow}>
          {/* Left Column: Big Green Duration, Distance & ETA Time */}
          <TouchableOpacity
            style={navBottomStyles.leftCol}
            onPress={() => setIsCollapsed((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={navBottomStyles.durationText}>{durationStr}</Text>
            <Text
              style={[
                navBottomStyles.distanceSub,
                isDay ? { color: "#5F6368" } : { color: "#94A3B8" },
              ]}
            >
              {distanceStr} · {etaStr}
            </Text>

            {!isCollapsed && (
              /* Compact GNSS/DR Status Badge */
              <View
                style={[
                  navBottomStyles.statusBadge,
                  {
                    backgroundColor: navStatus.bg,
                    borderColor: navStatus.color,
                  },
                ]}
              >
                <View
                  style={[
                    navBottomStyles.statusDot,
                    { backgroundColor: navStatus.dot },
                  ]}
                />
                <Text
                  style={[
                    navBottomStyles.statusText,
                    { color: navStatus.color },
                  ]}
                  numberOfLines={1}
                >
                  {navMode === "DR" || isSimulatedBlackout
                    ? "GPS Blackout · AI-DR Active"
                    : navStatus.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Center Column: Live Speedometer */}
          <View
            style={[
              navBottomStyles.speedContainer,
              isDay && {
                backgroundColor: "rgba(241, 243, 244, 0.95)",
                borderColor: "rgba(218, 220, 224, 0.9)",
              },
            ]}
          >
            <Text
              style={[
                navBottomStyles.speedNumber,
                isDay && { color: "#202124" },
              ]}
            >
              {speedKmh.toFixed(0)}
            </Text>
            <Text
              style={[
                navBottomStyles.speedUnit,
                isDay && { color: "#5F6368" },
              ]}
            >
              KM/H
            </Text>
          </View>

          {/* Right Column: Red Exit Navigation Button */}
          <TouchableOpacity
            style={navBottomStyles.exitNavBtn}
            onPress={onExitNavigation}
            activeOpacity={0.8}
          >
            <Text style={navBottomStyles.exitNavBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const navBottomStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 10 : 20,
    left: 12,
    right: 12,
    zIndex: 100,
  },

  floatingPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  recenterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(218, 220, 224, 0.9)",
    gap: 6,
  },

  recenterArrow: {
    color: "#1A73E8",
    fontSize: 12,
    fontWeight: "900",
  },

  recenterText: {
    color: "#1A73E8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  reportPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(218, 220, 224, 0.9)",
    gap: 5,
  },

  reportIcon: {
    fontSize: 14,
  },

  reportText: {
    color: "#3C4043",
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },

  cardDay: {
    backgroundColor: "rgba(255, 255, 255, 0.99)",
    borderColor: "rgba(218, 220, 224, 0.95)",
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },

  cardNight: {
    backgroundColor: "rgba(18, 24, 38, 0.97)",
    borderColor: "rgba(51, 65, 85, 0.75)",
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },

  collapseHandle: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    marginBottom: 6,
  },

  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.6)",
  },

  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftCol: {
    flex: 1,
  },

  durationText: {
    color: "#188038", // Google Maps Signature Green
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  distanceSub: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    gap: 5,
    maxWidth: 180,
  },

  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  statusText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  speedContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 15, 25, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
    marginHorizontal: 10,
  },

  speedNumber: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  speedUnit: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  exitNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },

  exitNavBtnText: {
    color: "#EF4444",
    fontSize: 18,
    fontWeight: "900",
  },
});
