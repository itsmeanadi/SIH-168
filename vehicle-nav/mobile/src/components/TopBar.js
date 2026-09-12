import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../locales/i18n";

// ============================================================
// SIH-168 — Top Floating Search Bar & Status Banners (Idle Mode)
// Google Maps Day/Night Responsive Theme Header
// ============================================================

export default function TopBar({
  theme = "day",
  onOpenSearch,
  onOpenVoice,
  connectionStatus,
  onConnectWebSocket,
  blackoutBanner,
  recoveryBanner,
  isReconnecting,
}) {
  const isDay = theme === "day";
  const { t } = useLanguage();

  return (
    <View style={topStyles.topBarWrapper} pointerEvents="box-none">
      {/* Google-Maps-Style Floating Search Bar */}
      <TouchableOpacity
        style={[
          topStyles.searchBar,
          isDay ? topStyles.searchBarDay : topStyles.searchBarNight,
        ]}
        onPress={onOpenSearch}
        activeOpacity={0.85}
      >
        <View style={topStyles.searchBarLeft}>
          <View
            style={[
              topStyles.searchIconOrb,
              isDay && { backgroundColor: "rgba(26, 115, 232, 0.12)" },
            ]}
          >
            <Text style={topStyles.searchIconText}>🔍</Text>
          </View>
          <View style={topStyles.searchLabelGroup}>
            <Text
              style={[
                topStyles.searchMainTitle,
                isDay && { color: "#202124" },
              ]}
            >
              {t("SearchDestination")}
            </Text>
            <Text
              style={[
                topStyles.searchSubTitle,
                isDay && { color: "#5F6368" },
              ]}
            >
              {t("OrSayWhereTo")}
            </Text>
          </View>
        </View>

        {/* Voice Assistant Mic Button */}
        {onOpenVoice && (
          <TouchableOpacity
            style={[
              topStyles.micButton,
              isDay && {
                backgroundColor: "rgba(26, 115, 232, 0.12)",
                borderColor: "rgba(26, 115, 232, 0.35)",
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onOpenVoice();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="mic" size={20} color={isDay ? "#1A73E8" : "#4285F4"} />
          </TouchableOpacity>
        )}

        {/* Server Connection Indicator */}
        <TouchableOpacity
          style={[
            topStyles.connectionIndicator,
            isDay && {
              backgroundColor: "rgba(241, 243, 244, 0.95)",
              borderColor: "rgba(218, 220, 224, 0.9)",
            },
          ]}
          onPress={onConnectWebSocket}
          activeOpacity={0.7}
        >
          <View
            style={[
              topStyles.connectionDot,
              {
                backgroundColor:
                  connectionStatus === "CONNECTED"
                    ? "#10B981"
                    : connectionStatus === "CONNECTING"
                    ? "#F59E0B"
                    : "#EF4444",
              },
            ]}
          />
          <Text
            style={[
              topStyles.connectionLabel,
              isDay && { color: "#3C4043" },
            ]}
          >
            {connectionStatus === "CONNECTED"
              ? t("Online")
              : connectionStatus === "CONNECTING"
              ? t("Syncing")
              : t("Offline")}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Large banners removed as requested to reduce noise. 
          We rely on the small connection status pill above. */}
    </View>
  );
}

const topStyles = StyleSheet.create({
  topBarWrapper: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 12,
    left: 14,
    right: 14,
    zIndex: 100,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  searchBarDay: {
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderColor: "rgba(218, 220, 224, 0.95)",
    shadowOpacity: 0.15,
  },

  searchBarNight: {
    backgroundColor: "rgba(18, 24, 38, 0.94)",
    borderColor: "rgba(51, 65, 85, 0.7)",
    shadowOpacity: 0.35,
  },

  searchBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  searchIconOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(66, 133, 244, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchIconText: {
    fontSize: 18,
  },

  searchLabelGroup: {
    flex: 1,
  },

  searchMainTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },

  searchSubTitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    marginTop: 1,
  },

  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(66, 133, 244, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(66, 133, 244, 0.4)",
  },

  micIcon: {
    fontSize: 18,
  },

  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
  },

  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  connectionLabel: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
  },

  contextBannerBlackout: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    elevation: 6,
  },

  contextBannerReconnecting: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.95)", // Orange color for reconnecting
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    elevation: 6,
  },

  contextBannerRecovery: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.95)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    elevation: 6,
  },

  contextBannerIcon: {
    fontSize: 20,
  },

  contextBannerTextCol: {
    flex: 1,
  },

  contextBannerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  contextBannerSub: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11,
    marginTop: 1,
  },
});
