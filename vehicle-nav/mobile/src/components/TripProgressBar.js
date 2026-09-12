import React from "react";
import { StyleSheet, View, Text, Platform } from "react-native";

// ============================================================
// SIH-168 — Google Maps Signature Vertical Trip Progress Bar
// Left-side Traffic Status Bar with Moving Current Location Puck
// ============================================================

export default function TripProgressBar({
  progress = 0.25, // 0.0 (start) to 1.0 (destination reached)
  isNavigating,
}) {
  if (!isNavigating) return null;

  // Clamp progress between 0.06 and 0.92 so the puck doesn't clip the ends
  const clampedProgress = Math.max(0.06, Math.min(0.92, progress));
  const puckBottomPercent = `${Math.round(clampedProgress * 100)}%`;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      {/* Google Maps Outer Translucent Capsule */}
      <View style={styles.capsule}>
        {/* Red Destination Pin Dot at the top */}
        <View style={styles.destPinDot} />

        {/* Central Traffic Status Track */}
        <View style={styles.trackContainer}>
          {/* Top segment: Clear Blue */}
          <View style={[styles.trafficSegment, { flex: 2.5, backgroundColor: "#1A73E8" }]} />
          {/* Traffic Status Slowdown: Orange */}
          <View style={[styles.trafficSegment, { flex: 2.2, backgroundColor: "#FB8C00" }]} />
          {/* Traffic Status Heavy: Red */}
          <View style={[styles.trafficSegment, { flex: 1.2, backgroundColor: "#E53935" }]} />
          {/* Bottom segment: Clear Blue */}
          <View style={[styles.trafficSegment, { flex: 3.0, backgroundColor: "#1A73E8" }]} />

          {/* Route Elapsed (Overlay darkening previous track) */}
          <View style={[styles.elapsedOverlay, { height: puckBottomPercent }]} />
        </View>

        {/* Moving Current Location Puck (White Circle with Blue Border & Dot) */}
        <View style={[styles.locationPuck, { bottom: puckBottomPercent }]}>
          <View style={styles.locationPuckInner} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    top: Platform.OS === "android" ? 170 : 185,
    height: 180,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
  },

  capsule: {
    width: 24,
    height: 180,
    backgroundColor: "rgba(224, 242, 254, 0.78)", // Light ice-blue translucent glass
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
    position: "relative",
  },

  destPinDot: {
    position: "absolute",
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EA4335", // Google Red destination dot
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 10,
  },

  trackContainer: {
    width: 5,
    height: 152,
    backgroundColor: "#E2E8F0",
    borderRadius: 2.5,
    overflow: "hidden",
    position: "relative",
  },

  trafficSegment: {
    width: "100%",
  },

  elapsedOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(30, 41, 59, 0.35)", // Subtle dim of already traveled track
  },

  locationPuck: {
    position: "absolute",
    left: 3, // Centered on the 24px capsule ((24 - 18) / 2 = 3)
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#1A73E8", // Blue ring
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 15,
  },

  locationPuckInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1A73E8", // Blue center dot
  },
});
