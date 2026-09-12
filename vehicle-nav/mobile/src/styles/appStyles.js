import { StyleSheet, Platform, StatusBar } from "react-native";

// ============================================================
// SIH-168 — Consolidated Design System & StyleSheet
// ============================================================

export const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  webViewContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F8F9FA",
  },

  webView: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F8F9FA",
  },

  mapLoadingPill: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    elevation: 6,
  },

  mapLoadingPillText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },

  routingLoadingPill: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 132, 199, 0.95)",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    gap: 10,
    elevation: 8,
  },

  routingLoadingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ----------------------------------------------------------
  // TOP FLOATING NAVIGATION BAR / TURN HEADER (PINNED TO TOP)
  // ----------------------------------------------------------
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
    backgroundColor: "rgba(18, 24, 38, 0.94)",
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  searchBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  searchIconOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(2, 132, 199, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchIconText: {
    fontSize: 15,
  },

  searchLabelGroup: {
    flex: 1,
  },

  searchMainTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  searchSubTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },

  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.5)",
    gap: 6,
  },

  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  connectionLabel: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },

  // Turn Header
  turnHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0284C7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },

  turnIconOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  turnIconText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  turnTextGroup: {
    flex: 1,
  },

  turnDistanceText: {
    color: "#E0F2FE",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  turnInstructionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },

  exitRouteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  exitRouteText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  // Context Banners
  contextBannerBlackout: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(180, 83, 9, 0.95)",
    borderRadius: 14,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FBBF24",
    gap: 10,
    elevation: 6,
  },

  contextBannerRecovery: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(4, 120, 87, 0.95)",
    borderRadius: 14,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#34D399",
    gap: 10,
    elevation: 6,
  },

  contextBannerIcon: {
    fontSize: 16,
  },

  contextBannerTextCol: {
    flex: 1,
  },

  contextBannerTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  contextBannerSub: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 10.5,
    fontWeight: "500",
  },

  // ----------------------------------------------------------
  // FLOATING MAP CONTROLS & JUDGE DEMO FABs
  // ----------------------------------------------------------
  floatingControlsWrapper: {
    position: "absolute",
    right: 14,
    bottom: 220,
    alignItems: "center",
    gap: 10,
    zIndex: 90,
  },

  simBlackoutFab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },

  simBlackoutText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  techTelemetryFab: {
    backgroundColor: "rgba(2, 132, 199, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#38BDF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },

  techTelemetryIcon: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  zoomControlStack: {
    backgroundColor: "rgba(18, 24, 38, 0.92)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },

  zoomButtonTop: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  zoomButtonBottom: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  zoomDivider: {
    height: 1,
    backgroundColor: "rgba(51, 65, 85, 0.7)",
  },

  zoomButtonText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },

  recenterFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(18, 24, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },

  recenterFabIcon: {
    fontSize: 17,
  },

  // ----------------------------------------------------------
  // BOTTOM NAVIGATION SHEET (PINNED TO BOTTOM OF SCREEN)
  // ----------------------------------------------------------
  bottomSheetWrapper: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 10 : 18,
    left: 12,
    right: 12,
    zIndex: 100,
  },

  bottomSheet: {
    backgroundColor: "rgba(18, 24, 38, 0.96)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },

  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    alignSelf: "center",
    marginBottom: 8,
  },

  sheetStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  navModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },

  navModeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  navModeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  aiTrustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },

  aiTrustLabel: {
    color: "#FCD34D",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  aiTrustValue: {
    color: "#FEF08A",
    fontSize: 12,
    fontWeight: "800",
  },

  sensorStatusBadge: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.4)",
  },

  sensorStatusText: {
    fontSize: 10.5,
    fontWeight: "600",
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(11, 15, 25, 0.65)",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.45)",
  },

  speedBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },

  speedDigits: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },

  speedUnitLabel: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "700",
  },

  verticalSeparator: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },

  metricItem: {
    alignItems: "center",
  },

  metricLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  metricValuePrimary: {
    color: "#F8FAFC",
    fontSize: 13.5,
    fontWeight: "800",
  },

  metricValueSecondary: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "700",
  },

  // Live IMU Strip in Card
  liveImuStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },

  imuStripLabel: {
    color: "#38BDF8",
    fontSize: 9.5,
    fontWeight: "800",
  },

  imuStripValues: {
    color: "#CBD5E1",
    fontSize: 9.5,
    fontWeight: "600",
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
  },

  imuStripMore: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
  },

  // Footer Row
  sheetFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "rgba(51, 65, 85, 0.4)",
  },

  footerCoords: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "500",
    flex: 1,
  },

  footerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },

  footerBackendInfo: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "600",
  },

  // ----------------------------------------------------------
  // JUDGE TELEMETRY MODAL STYLES
  // ----------------------------------------------------------
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },

  telemetryCard: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    borderTopWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "800",
  },

  modalSub: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 1,
  },

  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
  },

  techSection: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
  },

  techSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  techSectionTitle: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  techRateBadge: {
    backgroundColor: "rgba(2, 132, 199, 0.25)",
    color: "#7DD3FC",
    fontSize: 9.5,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },

  axisGrid: {
    flexDirection: "row",
    gap: 8,
  },

  axisBox: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },

  axisLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 2,
  },

  axisValue: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
  },

  specGrid: {
    marginTop: 6,
    gap: 4,
  },

  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51, 65, 85, 0.3)",
  },

  specKey: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },

  specVal: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
  },

  modalBlackoutBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },

  modalBlackoutBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Destination Search Modal
  modalCard: {
    backgroundColor: "#121826",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.8)",
  },

  modalHint: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 16,
  },

  presetSectionTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 24, 38, 0.9)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    gap: 12,
  },

  presetIconOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(2, 132, 199, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  presetIconText: {
    fontSize: 18,
  },

  presetTextCol: {
    flex: 1,
  },

  presetTitle: {
    color: "#F8FAFC",
    fontSize: 13.5,
    fontWeight: "700",
  },

  presetSub: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },

  presetArrow: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "800",
  },
  
  // V2V Sync Banner
  v2vBanner: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 1000,
  },
  v2vBannerText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },

  // SOS Receiver Banner
  sosBanner: {
    position: "absolute",
    top: 160, // below V2V banner
    alignSelf: "center",
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: "#b91c1c"
  },
  sosBannerText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },

  // Rollover Alert Banner
  rolloverBanner: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "#f97316", // Orange warning
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: "#c2410c"
  },
  rolloverBannerText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  }
});
