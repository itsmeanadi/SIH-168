import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { styles } from "../styles/appStyles";

// ============================================================
// SIH-168 — Judge Tech & AI Telemetry Modal Component
// ============================================================

export default function TelemetryModal({
  visible,
  onClose,
  imuHz,
  liveAccel,
  liveGyro,
  aiTrust,
  motionState,
  isZuptActive,
  isSimulatedBlackout,
  onToggleBlackout,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.telemetryCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Inertial & AI Telemetry</Text>
              <Text style={styles.modalSub}>
                SIH-168 Real-Time State & Sensor Inspection
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Live IMU Sensor Acceleration */}
            <View style={styles.techSection}>
              <View style={styles.techSectionHeader}>
                <Text style={styles.techSectionTitle}>
                  1. Accelerometer (3-Axis m/s²)
                </Text>
                <Text style={styles.techRateBadge}>{imuHz} Hz</Text>
              </View>
              <View style={styles.axisGrid}>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>X (Lateral)</Text>
                  <Text style={styles.axisValue}>{liveAccel.x.toFixed(3)}</Text>
                </View>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>Y (Forward)</Text>
                  <Text style={styles.axisValue}>{liveAccel.y.toFixed(3)}</Text>
                </View>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>Z (Vertical)</Text>
                  <Text style={styles.axisValue}>{liveAccel.z.toFixed(3)}</Text>
                </View>
              </View>
            </View>

            {/* 2. Live IMU Gyroscope */}
            <View style={styles.techSection}>
              <View style={styles.techSectionHeader}>
                <Text style={styles.techSectionTitle}>
                  2. Gyroscope (3-Axis rad/s)
                </Text>
                <Text style={styles.techRateBadge}>50 Hz</Text>
              </View>
              <View style={styles.axisGrid}>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>Roll (ωx)</Text>
                  <Text style={styles.axisValue}>{liveGyro.x.toFixed(3)}</Text>
                </View>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>Pitch (ωy)</Text>
                  <Text style={styles.axisValue}>{liveGyro.y.toFixed(3)}</Text>
                </View>
                <View style={styles.axisBox}>
                  <Text style={styles.axisLabel}>Yaw (ωz)</Text>
                  <Text style={styles.axisValue}>{liveGyro.z.toFixed(3)}</Text>
                </View>
              </View>
            </View>

            {/* 3. AI & 15-State ES-EKF Fusion Engine */}
            <View style={styles.techSection}>
              <Text style={styles.techSectionTitle}>
                3. AI & State Estimation (SIH-168)
              </Text>
              <View style={styles.specGrid}>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Fusion Algorithm</Text>
                  <Text style={styles.specVal}>15-State Error-State EKF</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>AI SpeedNet Model</Text>
                  <Text style={styles.specVal}>1D-CNN + BiLSTM Kinematics</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>AI Trust Metric</Text>
                  <Text
                    style={[
                      styles.specVal,
                      {
                        color:
                          aiTrust >= 0.75
                            ? "#34D399"
                            : aiTrust >= 0.45
                            ? "#FBBF24"
                            : "#F87171",
                      },
                    ]}
                  >
                    {Math.round(aiTrust * 100)}% Confidence
                  </Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Two-Wheeler Constraints</Text>
                  <Text style={styles.specVal}>Adaptive NHC (Non-Holonomic)</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Motion Detection</Text>
                  <Text style={styles.specVal}>{motionState}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Zero Velocity (ZUPT)</Text>
                  <Text style={styles.specVal}>
                    {isZuptActive ? "ACTIVE (STATIONARY)" : "INACTIVE (DRIVING)"}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. Live Blackout Simulation Action */}
            <View style={styles.techSection}>
              <Text style={styles.techSectionTitle}>4. Judge Blackout Testing</Text>
              <TouchableOpacity
                style={[
                  styles.modalBlackoutBtn,
                  { backgroundColor: isSimulatedBlackout ? "#EF4444" : "#0284C7" },
                ]}
                onPress={onToggleBlackout}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBlackoutBtnText}>
                  {isSimulatedBlackout
                    ? "🛰️ RESTORE GNSS (TRIGGER RECOVERY)"
                    : "⚡ SIMULATE TUNNEL / GNSS BLACKOUT"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
