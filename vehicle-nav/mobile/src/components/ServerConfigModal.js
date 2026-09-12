import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WEBSOCKET_URL } from "../constants/config";

export default function ServerConfigModal({ visible, onClose, onUrlUpdated }) {
  const [url, setUrl] = useState(WEBSOCKET_URL);

  useEffect(() => {
    if (visible) {
      loadUrl();
    }
  }, [visible]);

  const loadUrl = async () => {
    try {
      const saved = await AsyncStorage.getItem("custom_ws_url");
      if (saved) setUrl(saved);
    } catch (e) {
      console.log(e);
    }
  };

  const saveUrl = async () => {
    try {
      await AsyncStorage.setItem("custom_ws_url", url);
      onUrlUpdated(url);
      onClose();
    } catch (e) {
      console.log(e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="server" size={24} color="#facc15" />
            <Text style={styles.title}>Server Configuration</Text>
          </View>
          
          <Text style={styles.desc}>
            Enter your Local IPv4 Address (e.g. ws://192.168.1.5:8000) or Render URL (wss://sih.onrender.com).
          </Text>

          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="ws://192.168.1.5:8000"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveUrl}>
              <Text style={styles.saveBtnText}>Save & Reconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#f3f4f6",
  },
  desc: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  cancelBtnText: {
    color: "#9ca3af",
    fontWeight: "bold",
    fontSize: 16,
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
  },
  saveBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
