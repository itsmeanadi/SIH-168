import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../locales/i18n";
import LanguageSelectorModal from "./LanguageSelectorModal";
import V2VModal from "./V2VModal";

// ============================================================
// SIH-168 — Consolidated Single-FAB Quick Tools Menu
// All Floating Controls Packed into One Expandable Action Hub
// ============================================================

export default function FloatingControls({
  theme = "day",
  onToggleTheme,
  onClearTrail,
  isNavigating,
  showRecenter,
  isSimulatedBlackout,
  onToggleBlackout,
  onOpenTelemetry,
  onOpenVoice,
  onZoomIn,
  onZoomOut,
  onRecenter,
  isRolloverWarningEnabled,
  onToggleRolloverWarning,
  isCrashWarningEnabled,
  onToggleCrashWarning,
  onOpenServerConfig,
}) {
  const isDay = theme === "day";
  const [isOpen, setIsOpen] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [v2vModalVisible, setV2vModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(200)).current;
  const { t } = useLanguage();

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const handleAction = (actionFn) => {
    if (actionFn) actionFn();
    // Keep menu open for quick zoom/blackout toggles, or close if desired
  };

  return (
    <View
      style={[
        styles.container,
        isNavigating && { bottom: 100 },
      ]}
      pointerEvents="box-none"
    >
      {/* Recenter Button: appears in idle mode when user panned away */}
      {showRecenter && !isNavigating && (
        <TouchableOpacity
          style={[
            styles.recenterFab,
            isDay ? styles.cardDay : styles.cardNight,
          ]}
          onPress={onRecenter}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
          <Text style={styles.recenterText}>{t("Recenter")}</Text>
        </TouchableOpacity>
      )}

      {/* Expandable Quick Actions Popup Menu */}
      {isOpen && (
        <View
          style={[
            styles.popupMenu,
            isDay ? styles.popupDay : styles.popupNight,
          ]}
        >
          {/* Header */}
          <View style={styles.popupHeader}>
            <Text
              style={[
                styles.popupTitle,
                { color: isDay ? "#202124" : "#F8FAFC" },
              ]}
            >
              QUICK CONTROLS
            </Text>
            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action Grid */}
          <View style={styles.gridContainer}>
            {/* 1. Theme Toggle */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => handleAction(onToggleTheme)}
              activeOpacity={0.7}
            >
              <Ionicons name={isDay ? "moon" : "sunny"} size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {isDay ? t("NightMode") : t("DayMode")}
              </Text>
            </TouchableOpacity>

            {/* 2. Clear Trail */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => handleAction(onClearTrail)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-bin" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("ClearTrail")}
              </Text>
            </TouchableOpacity>

            {/* 3. Blackout Simulation */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isSimulatedBlackout
                  ? styles.gridItemBlackoutActive
                  : isDay
                  ? styles.gridItemDay
                  : styles.gridItemNight,
              ]}
              onPress={() => handleAction(onToggleBlackout)}
              activeOpacity={0.7}
            >
              <Ionicons name="flash" size={20} color={isSimulatedBlackout ? "#FFFFFF" : isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  isSimulatedBlackout
                    ? { color: "#FFFFFF", fontWeight: "700" }
                    : { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {isSimulatedBlackout ? t("EndBlackout") : t("GPSBlackout")}
              </Text>
            </TouchableOpacity>

            {/* 4. Voice Assistant */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                handleAction(onOpenVoice);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="mic" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("VoiceNav")}
              </Text>
            </TouchableOpacity>

            {/* 5. Telemetry & AI HUD */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                handleAction(onOpenTelemetry);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="speedometer" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("IMUAndAI")}
              </Text>
            </TouchableOpacity>

            {/* 6. Recenter Location */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                handleAction(onRecenter);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="locate" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("Recenter")}
              </Text>
            </TouchableOpacity>

            {/* 7. Language Selector */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                setLangModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("Language")}
              </Text>
            </TouchableOpacity>

            {/* 8. V2V Mesh Sync */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                setV2vModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="radio" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("V2V")}
              </Text>
            </TouchableOpacity>

            {/* 9. Slope Alert Toggle */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isRolloverWarningEnabled
                  ? styles.gridItemBlackoutActive
                  : isDay
                  ? styles.gridItemDay
                  : styles.gridItemNight,
              ]}
              onPress={() => handleAction(onToggleRolloverWarning)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="warning"
                size={20}
                color={isRolloverWarningEnabled ? "#FFFFFF" : isDay ? "#3C4043" : "#E2E8F0"}
                style={{ marginBottom: 4 }}
              />
              <Text
                style={[
                  styles.gridItemLabel,
                  isRolloverWarningEnabled
                    ? { color: "#FFFFFF", fontWeight: "700" }
                    : { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                {t("SlopeAlert")}
              </Text>
            </TouchableOpacity>

            {/* 9b. Crash/SOS Toggle */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isCrashWarningEnabled
                  ? styles.gridItemBlackoutActive // Reusing the red active style
                  : isDay
                  ? styles.gridItemDay
                  : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                handleAction(onToggleCrashWarning);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="car"
                size={20}
                color={isCrashWarningEnabled ? "#FFFFFF" : isDay ? "#3C4043" : "#E2E8F0"}
                style={{ marginBottom: 4 }}
              />
              <Text
                style={[
                  styles.gridItemLabel,
                  isCrashWarningEnabled
                    ? { color: "#FFFFFF", fontWeight: "700" }
                    : { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                Crash SOS
              </Text>
            </TouchableOpacity>

            {/* 10. Server Config (Network) */}
            <TouchableOpacity
              style={[
                styles.gridItem,
                isDay ? styles.gridItemDay : styles.gridItemNight,
              ]}
              onPress={() => {
                setIsOpen(false);
                handleAction(onOpenServerConfig);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="server" size={20} color={isDay ? "#3C4043" : "#E2E8F0"} style={{ marginBottom: 4 }} />
              <Text
                style={[
                  styles.gridItemLabel,
                  { color: isDay ? "#3C4043" : "#E2E8F0" },
                ]}
              >
                Server IP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Zoom In / Out Strip */}
          <View style={styles.zoomRow}>
            <TouchableOpacity
              style={[
                styles.zoomBtn,
                isDay ? styles.zoomBtnDay : styles.zoomBtnNight,
              ]}
              onPress={() => handleAction(onZoomIn)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.zoomBtnText,
                  { color: isDay ? "#202124" : "#F8FAFC" },
                ]}
              >
                {t("ZoomIn")}
              </Text>
            </TouchableOpacity>

            <View style={styles.zoomDivider} />

            <TouchableOpacity
              style={[
                styles.zoomBtn,
                isDay ? styles.zoomBtnDay : styles.zoomBtnNight,
              ]}
              onPress={() => handleAction(onZoomOut)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.zoomBtnText,
                  { color: isDay ? "#202124" : "#F8FAFC" },
                ]}
              >
                {t("ZoomOut")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Single Floating Action Hub Button */}
      <TouchableOpacity
        style={[
          styles.mainFab,
          isOpen && styles.mainFabActive,
          isDay ? styles.cardDay : styles.cardNight,
        ]}
        onPress={toggleMenu}
        activeOpacity={0.85}
      >
        <Ionicons name={isOpen ? "close" : "settings"} size={22} color={isDay ? "#3C4043" : "#F8FAFC"} />
        {!isOpen && isSimulatedBlackout && (
          <View style={styles.blackoutBadgeDot} />
        )}
        {/* Notification Dot */}
      </TouchableOpacity>

      <LanguageSelectorModal 
        visible={langModalVisible} 
        onClose={() => setLangModalVisible(false)} 
      />

      <V2VModal
        visible={v2vModalVisible}
        onClose={() => setV2vModalVisible(false)}
        onBroadcastAnchor={() => {
          // Send broadcast event (will be hooked up via props or event emitter)
          if (global.broadcastV2VAnchor) global.broadcastV2VAnchor();
        }}
        onScanForAnchors={() => {
          // Scan for anchors
          if (global.scanV2VAnchors) global.scanV2VAnchors();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    bottom: 110, // lowered further
    alignItems: "flex-end",
    gap: 10,
    zIndex: 95,
  },

  cardDay: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderColor: "rgba(218, 220, 224, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },

  cardNight: {
    backgroundColor: "rgba(18, 24, 38, 0.96)",
    borderColor: "rgba(51, 65, 85, 0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  mainFab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },

  mainFabActive: {
    backgroundColor: "#1A73E8",
    borderColor: "#4285F4",
  },

  mainFabIcon: {
    fontSize: 22,
  },

  blackoutBadgeDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  recenterFab: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 13,
    height: 40,
    borderWidth: 1.5,
    borderColor: "#1A73E8",
    backgroundColor: "#1A73E8",
    gap: 5,
  },

  recenterIcon: {
    fontSize: 16,
  },

  recenterText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  popupMenu: {
    width: 250,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 6,
  },

  popupDay: {
    backgroundColor: "rgba(255, 255, 255, 0.99)",
    borderColor: "rgba(218, 220, 224, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
  },

  popupNight: {
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderColor: "rgba(51, 65, 85, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },

  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.25)",
  },

  popupTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  closeBtn: {
    padding: 2,
  },

  closeBtnText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "bold",
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },

  gridItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },

  gridItemDay: {
    backgroundColor: "#F1F3F4",
    borderColor: "#DADCE0",
  },

  gridItemNight: {
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderColor: "rgba(71, 85, 105, 0.5)",
  },

  gridItemBlackoutActive: {
    backgroundColor: "#EF4444",
    borderColor: "#DC2626",
  },

  gridItemIcon: {
    fontSize: 16,
  },

  gridItemLabel: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },

  zoomRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.25)",
  },

  zoomBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  zoomBtnDay: {
    backgroundColor: "#F8F9FA",
    borderColor: "#DADCE0",
  },

  zoomBtnNight: {
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderColor: "rgba(71, 85, 105, 0.6)",
  },

  zoomBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
