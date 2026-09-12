import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Modal } from "react-native";
import { useLanguage } from "../locales/i18n";
import { Ionicons } from "@expo/vector-icons";

export default function LanguageSelectorModal({ visible, onClose }) {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
    { code: "bn", label: "বাংলা" },
    { code: "te", label: "తెలుగు" },
    { code: "ta", label: "தமிழ்" },
    { code: "mr", label: "मराठी" },
    { code: "gu", label: "ગુજરાતી" },
  ];

  const handleSelect = (code) => {
    setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t("Language")}</Text>
          <View style={styles.list}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.option,
                  language === lang.code && styles.selectedOption
                ]}
                onPress={() => handleSelect(lang.code)}
              >
                <Text style={[
                  styles.optionText,
                  language === lang.code && styles.selectedOptionText
                ]}>
                  {lang.label}
                </Text>
                {language === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#1A73E8" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#202124",
    marginBottom: 16,
    textAlign: "center",
  },
  list: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  selectedOption: {
    backgroundColor: "rgba(26, 115, 232, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(26, 115, 232, 0.3)",
  },
  optionText: {
    fontSize: 16,
    color: "#3C4043",
  },
  selectedOptionText: {
    fontWeight: "700",
    color: "#1A73E8",
  },
});
