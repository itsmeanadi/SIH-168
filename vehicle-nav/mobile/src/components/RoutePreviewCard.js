import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../locales/i18n";

// ============================================================
// SIH-168 — Official Google Maps Route Overview & Mode Selector
// Drive/Transit/Walk/Bike Tabs • Tolls & Eco Badges • Traffic Bar
// ============================================================

export default function RoutePreviewCard({
  destination,
  routeInfo,
  onStartNavigation,
  onCancel,
}) {
  const [selectedMode, setSelectedMode] = useState("drive"); // 'drive' | 'transit' | 'walk' | 'bike'
  const { t } = useLanguage();

  if (!destination || !routeInfo) return null;

  const durationMin = routeInfo.durationMin || Math.max(1, Math.round(routeInfo.durationSeconds / 60));
  const distanceKm = routeInfo.distanceKm || (routeInfo.distanceMeters / 1000).toFixed(1);

  // Computed mode times
  const transitTime = `${Math.round(durationMin * 1.4)} min`;
  const walkTime = `${Math.round((distanceKm / 4.5) * 60)} min`;
  const bikeTime = `${Math.round((distanceKm / 15) * 60)} min`;

  return (
    <View style={previewStyles.wrapper} pointerEvents="box-none">
      {/* 1. TOP ORIGIN / DESTINATION CAPSULE CARD */}
      <View style={previewStyles.topOriginDestCard}>
        <TouchableOpacity style={previewStyles.backBtn} onPress={onCancel} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#3C4043" />
        </TouchableOpacity>

        <View style={previewStyles.originDestRows}>
          {/* Origin Row */}
          <View style={previewStyles.locRow}>
            <View style={previewStyles.originDot} />
            <Text style={previewStyles.locText} numberOfLines={1}>
              {t("Your location")}
            </Text>
          </View>

          {/* Dotted Vertical Connector */}
          <View style={previewStyles.dottedLine} />

          {/* Destination Row */}
          <View style={previewStyles.locRow}>
            <Text style={previewStyles.destPinIcon}>📍</Text>
            <Text style={previewStyles.locTextBold} numberOfLines={1}>
              {destination.title || destination.name || "Destination"}
            </Text>
          </View>
        </View>

        {/* Swap / Close Actions */}
        <View style={previewStyles.topRightActions}>
          <TouchableOpacity style={previewStyles.swapBtn} activeOpacity={0.7}>
            <Text style={previewStyles.swapBtnText}>⇅</Text>
          </TouchableOpacity>
          {/* Close button moved to back button on the left, but keep this for standard maps feel or remove it */}
        </View>
      </View>

      {/* 2. BOTTOM GOOGLE MAPS EXPANDABLE ROUTE SHEET */}
      <View style={previewStyles.bottomSheet}>
        {/* Drag Handle Bar */}
        <View style={previewStyles.handleBar} />

        {/* Travel Mode Selector Tab Bar */}
        <View style={previewStyles.modeTabBar}>
          {/* Drive */}
          <TouchableOpacity
            style={[
              previewStyles.modeTabItem,
              selectedMode === "drive" && previewStyles.modeTabActive,
            ]}
            onPress={() => setSelectedMode("drive")}
          >
            <Text style={previewStyles.modeTabIcon}>🚗</Text>
            <Text
              style={[
                previewStyles.modeTabText,
                selectedMode === "drive" && previewStyles.modeTabTextActive,
              ]}
            >
              {durationMin} min
            </Text>
          </TouchableOpacity>

          {/* Transit */}
          <TouchableOpacity
            style={[
              previewStyles.modeTabItem,
              selectedMode === "transit" && previewStyles.modeTabActive,
            ]}
            onPress={() => setSelectedMode("transit")}
          >
            <Text style={previewStyles.modeTabIcon}>🚇</Text>
            <Text
              style={[
                previewStyles.modeTabText,
                selectedMode === "transit" && previewStyles.modeTabTextActive,
              ]}
            >
              {transitTime}
            </Text>
          </TouchableOpacity>

          {/* Walk */}
          <TouchableOpacity
            style={[
              previewStyles.modeTabItem,
              selectedMode === "walk" && previewStyles.modeTabActive,
            ]}
            onPress={() => setSelectedMode("walk")}
          >
            <Text style={previewStyles.modeTabIcon}>🚶</Text>
            <Text
              style={[
                previewStyles.modeTabText,
                selectedMode === "walk" && previewStyles.modeTabTextActive,
              ]}
            >
              {walkTime}
            </Text>
          </TouchableOpacity>

          {/* Bike */}
          <TouchableOpacity
            style={[
              previewStyles.modeTabItem,
              selectedMode === "bike" && previewStyles.modeTabActive,
            ]}
            onPress={() => setSelectedMode("bike")}
          >
            <Text style={previewStyles.modeTabIcon}>🚴</Text>
            <Text
              style={[
                previewStyles.modeTabText,
                selectedMode === "bike" && previewStyles.modeTabTextActive,
              ]}
            >
              {bikeTime}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Duration & Distance Row */}
        <View style={previewStyles.routeSummaryHeader}>
          <Text style={previewStyles.mainDurationText}>
            {durationMin} min{" "}
            <Text style={previewStyles.mainDistanceText}>({distanceKm} km)</Text>
          </Text>
          <Text style={previewStyles.routeFastestSub}>
            Fastest route now due to traffic conditions
          </Text>
        </View>

        {/* Tolls & Fuel Savings Badges */}
        <View style={previewStyles.badgesList}>
          <View style={previewStyles.badgeRow}>
            <Text style={previewStyles.badgeIcon}>🏷️</Text>
            <Text style={previewStyles.badgeText}>
              Tolls · ₹65 estimated toll charges
            </Text>
          </View>
          <View style={previewStyles.badgeRow}>
            <Text style={previewStyles.badgeIcon}>🍃</Text>
            <Text style={previewStyles.badgeText}>
              Saves 4% more fuel than alternate highway routes
            </Text>
          </View>
        </View>

        {/* Traffic Timeline Visualizer */}
        <View style={previewStyles.trafficSection}>
          <Text style={previewStyles.trafficTitle}>Live Traffic Status</Text>
          <View style={previewStyles.trafficBar}>
            <View style={[previewStyles.trafficSeg, { flex: 4, backgroundColor: "#1A73E8" }]} />
            <View style={[previewStyles.trafficSeg, { flex: 2, backgroundColor: "#F59E0B" }]} />
            <View style={[previewStyles.trafficSeg, { flex: 1.5, backgroundColor: "#EF4444" }]} />
            <View style={[previewStyles.trafficSeg, { flex: 3.5, backgroundColor: "#1A73E8" }]} />
          </View>
          <View style={previewStyles.trafficTimesRow}>
            <Text style={previewStyles.trafficTimeLabel}>Now</Text>
            <Text style={previewStyles.trafficTimeLabel}>+15 min</Text>
            <Text style={previewStyles.trafficTimeLabel}>Arrival ({routeInfo.etaTime || "ETA"})</Text>
          </View>
        </View>

        {/* Action Button Row: Start Navigation & Pin */}
        <View style={previewStyles.actionBtnRow}>
          <TouchableOpacity
            style={previewStyles.startNavBtn}
            onPress={onStartNavigation}
            activeOpacity={0.85}
          >
            <Text style={previewStyles.startNavIcon}>▶</Text>
            <Text style={previewStyles.startNavText}>{t("Start")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={previewStyles.pinRouteBtn} activeOpacity={0.8}>
            <Text style={previewStyles.pinRouteIcon}>📌</Text>
            <Text style={previewStyles.pinRouteText}>Pin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    zIndex: 105,
    pointerEvents: "box-none",
  },

  topOriginDestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    marginTop: Platform.OS === "android" ? 34 : 48,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(218, 220, 224, 0.9)",
  },

  backBtn: {
    padding: 8,
    marginRight: 8,
  },

  originDestRows: {
    flex: 1,
    paddingRight: 10,
  },

  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#1A73E8",
    backgroundColor: "#FFFFFF",
    marginLeft: 2,
  },

  dottedLine: {
    width: 1.5,
    height: 12,
    backgroundColor: "#94A3B8",
    marginLeft: 6,
    marginVertical: 2,
  },

  destPinIcon: {
    fontSize: 14,
  },

  locText: {
    fontSize: 13,
    color: "#5F6368",
    fontWeight: "500",
    flex: 1,
  },

  locTextBold: {
    fontSize: 14,
    color: "#202124",
    fontWeight: "700",
    flex: 1,
  },

  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },

  swapBtnText: {
    color: "#5F6368",
    fontSize: 15,
    fontWeight: "bold",
  },

  closeTopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },

  closeTopText: {
    color: "#5F6368",
    fontSize: 13,
    fontWeight: "bold",
  },

  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 16,
    borderTopWidth: 1,
    borderColor: "rgba(218, 220, 224, 0.9)",
  },

  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DADCE0",
    alignSelf: "center",
    marginBottom: 12,
  },

  modeTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAED",
    paddingBottom: 8,
    marginBottom: 12,
    gap: 6,
  },

  modeTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "transparent",
  },

  modeTabActive: {
    backgroundColor: "#E8F0FE",
  },

  modeTabIcon: {
    fontSize: 17,
  },

  modeTabText: {
    fontSize: 11,
    color: "#5F6368",
    fontWeight: "600",
    marginTop: 2,
  },

  modeTabTextActive: {
    color: "#1A73E8",
    fontWeight: "800",
  },

  routeSummaryHeader: {
    marginBottom: 10,
  },

  mainDurationText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#188038", // Google Maps Green
    letterSpacing: -0.5,
  },

  mainDistanceText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5F6368",
  },

  routeFastestSub: {
    fontSize: 12,
    color: "#5F6368",
    marginTop: 2,
  },

  badgesList: {
    gap: 6,
    marginVertical: 8,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  badgeIcon: {
    fontSize: 13,
  },

  badgeText: {
    fontSize: 12,
    color: "#3C4043",
    fontWeight: "500",
  },

  trafficSection: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E8EAED",
  },

  trafficTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5F6368",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  trafficBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
  },

  trafficSeg: {
    height: "100%",
  },

  trafficTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },

  trafficTimeLabel: {
    fontSize: 10,
    color: "#70757A",
    fontWeight: "600",
  },

  actionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },

  startNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A73E8",
    borderRadius: 24,
    paddingVertical: 13,
    gap: 8,
    shadowColor: "#1A73E8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  startNavIcon: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  startNavText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  pinRouteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#DADCE0",
    gap: 6,
  },

  pinRouteIcon: {
    fontSize: 14,
  },

  pinRouteText: {
    fontSize: 14,
    color: "#1A73E8",
    fontWeight: "700",
  },
});
