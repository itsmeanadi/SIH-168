import React, { useEffect } from "react";
import { StyleSheet, View, Text, ActivityIndicator, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { MAP_HTML } from "./MapHtml";
import { styles } from "../styles/appStyles";

// ============================================================
// SIH-168 — Google-Maps Viewport Wrapper Component (Mobile & Web)
// ============================================================

export default function MapViewComponent({
  webViewRef,
  theme = "day",
  phoneLocation,
  vehiclePos,
  isRouting,
  onMapClicked,
  onUserPannedMap,
}) {
  useEffect(() => {
    if (Platform.OS === "web") {
      const handler = (event) => {
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data?.type === "map_clicked" && onMapClicked) {
            onMapClicked(data.lat, data.lng);
          } else if (data?.type === "user_panned_map" && onUserPannedMap) {
            onUserPannedMap();
          }
        } catch (_) {}
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }
  }, [onMapClicked, onUserPannedMap]);

  const isDay = theme === "day";

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDay ? "#F8F9FA" : "#0c1017" }]}>
      {Platform.OS === "web" ? (
        <iframe
          key={theme}
          ref={(el) => {
            if (webViewRef) {
              webViewRef.current = {
                postMessage: (msg) => {
                  try {
                    el?.contentWindow?.postMessage(msg, "*");
                  } catch (_) {}
                },
              };
            }
          }}
          srcDoc={MAP_HTML}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: isDay ? "#F8F9FA" : "#0c1017",
          }}
          onLoad={() => {
            setTimeout(() => {
              webViewRef.current?.postMessage(
                JSON.stringify({ type: "invalidate_size" })
              );
              webViewRef.current?.postMessage(
                JSON.stringify({ type: "set_theme", theme })
              );
            }, 300);
          }}
        />
      ) : (
        <WebView
          key={theme}
          ref={webViewRef}
          source={{ html: MAP_HTML, baseUrl: "https://localhost" }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          style={[styles.webView, { backgroundColor: isDay ? "#F8F9FA" : "#0c1017" }]}
          containerStyle={[styles.webViewContainer, { backgroundColor: isDay ? "#F8F9FA" : "#0c1017" }]}
          scrollEnabled={false}
          bounces={false}
          onLoadEnd={() => {
            setTimeout(() => {
              webViewRef.current?.postMessage(
                JSON.stringify({ type: "invalidate_size" })
              );
              webViewRef.current?.postMessage(
                JSON.stringify({ type: "set_theme", theme })
              );
            }, 300);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "map_clicked" && onMapClicked) {
                onMapClicked(data.lat, data.lng);
              } else if (data.type === "user_panned_map" && onUserPannedMap) {
                onUserPannedMap();
              }
            } catch (_) {}
          }}
        />
      )}

      {!phoneLocation && !vehiclePos && (
        <View style={styles.mapLoadingPill} pointerEvents="none">
          <ActivityIndicator size="small" color="#4285F4" />
          <Text style={styles.mapLoadingPillText}>Acquiring GPS & Sensors...</Text>
        </View>
      )}

      {isRouting && (
        <View style={styles.routingLoadingPill} pointerEvents="none">
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.routingLoadingText}>Calculating Route...</Text>
        </View>
      )}
    </View>
  );
}
