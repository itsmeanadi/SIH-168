import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Platform, StatusBar } from "react-native";

// ============================================================
// SIH-168 — Official Google Maps Emerald Turn-by-Turn Maneuver HUD
// Left Arrow + Distance • Street Name • "Then ↰" Next Step Capsule
// ============================================================

export default function NavigationManeuverBar({
  currentManeuver,
  nextManeuver,
  isOffRouteState,
  isRerouting,
  onExitNavigation,
}) {
  const icon = currentManeuver?.icon || "↑";
  const rawInstruction = currentManeuver?.instruction || "Follow route";
  const distance = currentManeuver?.formattedDistance || "300 m";

  // Clean street name extraction (e.g. "Turn left on Beaver St" -> "Beaver St")
  let streetName = rawInstruction;
  if (rawInstruction.toLowerCase().includes(" on ")) {
    streetName = rawInstruction.split(/ on /i)[1];
  } else if (rawInstruction.toLowerCase().includes(" onto ")) {
    streetName = rawInstruction.split(/ onto /i)[1];
  } else if (rawInstruction.toLowerCase().includes(" toward ")) {
    streetName = rawInstruction.split(/ toward /i)[1];
  }

  // Next step preview icon and label (for "Then ↰" chip)
  const nextIcon = nextManeuver?.icon || (icon === "↰" ? "↱" : "↰");

  return (
    <View style={navStyles.wrapper} pointerEvents="box-none">
      {/* Primary Google Maps Emerald Green Card */}
      <View
        style={[
          navStyles.mainCard,
          isRerouting && { backgroundColor: "#1E3A8A" },
          isOffRouteState && { backgroundColor: "#B45309" },
        ]}
      >
        {/* Left Column: Big White Turn Arrow & Distance Underneath */}
        <View style={navStyles.leftCol}>
          <Text style={navStyles.turnArrow}>{icon}</Text>
          <Text style={navStyles.distanceNumber}>
            {isRerouting ? "..." : isOffRouteState ? "Off" : distance}
          </Text>
        </View>

        {/* Center Column: Street / Highway Name */}
        <View style={navStyles.centerCol}>
          <Text style={navStyles.streetTitle} numberOfLines={1}>
            {isRerouting
              ? "Finding faster route..."
              : isOffRouteState
              ? "Off Route · Recalculating"
              : streetName}
          </Text>
          <Text style={navStyles.subInstruction} numberOfLines={1}>
            {rawInstruction}
          </Text>
        </View>

        {/* Exit Button */}
        <TouchableOpacity
          style={navStyles.exitBtn}
          onPress={onExitNavigation}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={navStyles.exitBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Secondary "Then ↰" Next Maneuver Capsule (Attached below left) */}
      {!isRerouting && !isOffRouteState && (
        <View style={navStyles.thenCapsule}>
          <Text style={navStyles.thenLabel}>Then</Text>
          <Text style={navStyles.thenArrow}>{nextIcon}</Text>
        </View>
      )}
    </View>
  );
}

const navStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 14,
    left: 12,
    right: 12,
    zIndex: 110,
  },

  mainCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D652D", // Google Maps Signature Navigation Green
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  leftCol: {
    alignItems: "center",
    justifyContent: "center",
    width: 65,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.2)",
    paddingRight: 8,
  },

  turnArrow: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 36,
  },

  distanceNumber: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.2,
  },

  centerCol: {
    flex: 1,
    justifyContent: "center",
  },

  streetTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  subInstruction: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  exitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },

  thenCapsule: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#084922", // Darker attached green pill
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginLeft: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },

  thenLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    fontWeight: "700",
  },

  thenArrow: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
