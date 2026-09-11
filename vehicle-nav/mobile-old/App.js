import React, { useEffect, useRef, useState } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

const SERVER_IP = " 10.28.28.17";
const SERVER_PORT = 8080;

const websocketUrl = `ws://${SERVER_IP}:${SERVER_PORT}`;

export default function App() {
    const webViewRef = useRef(null);

    const [location, setLocation] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let subscription;

        async function startGPS() {
            const { status } =
                await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
                return;
            }

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 1,
                    timeInterval: 1000,
                },
                (position) => {
                    const { latitude, longitude } = position.coords;

                    setLocation({
                        lat: latitude,
                        lng: longitude,
                    });

                    webViewRef.current?.postMessage(
                        JSON.stringify({
                            type: "phone_gps",
                            lat: latitude,
                            lng: longitude,
                        })
                    );
                }
            );
        }

        startGPS();

        return () => {
            subscription?.remove();
        };
    }, []);

    useEffect(() => {
        const ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
            console.log("Connected to laptop");
            setConnected(true);
        };

        ws.onclose = () => {
            console.log("Disconnected");
            setConnected(false);
        };

        ws.onerror = (error) => {
            console.log("WebSocket error", error);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "vehicle_position") {
                    webViewRef.current?.postMessage(
                        JSON.stringify(data)
                    );
                }
            } catch (error) {
                console.log(error);
            }
        };

        return () => ws.close();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Vehicle Navigation</Text>

                <View style={styles.statusRow}>
                    <View
                        style={[
                            styles.dot,
                            {
                                backgroundColor: connected
                                    ? "#22c55e"
                                    : "#ef4444",
                            },
                        ]}
                    />

                    <Text style={styles.status}>
                        {connected ? "SERVER CONNECTED" : "SERVER OFFLINE"}
                    </Text>
                </View>
            </View>

            <View style={styles.mapContainer}>
                <WebView
                    ref={webViewRef}
                    source={{ html: MAP_HTML }}
                    javaScriptEnabled
                    domStorageEnabled
                    originWhitelist={["*"]}
                    onMessage={(event) => {
                        console.log(event.nativeEvent.data);
                    }}
                />

                {!location && (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" />
                        <Text>Getting GPS location...</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <Text>
                    GPS:{" "}
                    {location
                        ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                        : "Searching..."}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport"
content="width=device-width, initial-scale=1.0, maximum-scale=1.0">

<link
rel="stylesheet"
href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

<script
src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">
</script>

<style>
html, body, #map {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

.vehicle {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  transition: transform 0.3s linear;
}

.gps-marker {
  width: 18px;
  height: 18px;
  background: #2563eb;
  border: 4px solid white;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(37,99,235,.6);
}
</style>
</head>

<body>

<div id="map"></div>

<script>

let map = L.map("map", {
  zoomControl: true
}).setView([22.7196, 75.8577], 15);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

let vehicleMarker = null;
let gpsMarker = null;

const vehicleIcon = L.divIcon({
  className: "",
  html: '<div class="vehicle">🚙</div>',
  iconSize: [42, 42],
  iconAnchor: [21, 21]
});

const gpsIcon = L.divIcon({
  className: "",
  html: '<div class="gps-marker"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

function updateVehicle(lat, lng, heading) {

  if (!vehicleMarker) {

    vehicleMarker = L.marker(
      [lat, lng],
      {
        icon: vehicleIcon
      }
    ).addTo(map);

    map.setView([lat, lng], 17);

  } else {

    vehicleMarker.setLatLng([lat, lng]);

  }

  const element =
    vehicleMarker.getElement();

  if (element) {

    const vehicle =
      element.querySelector(".vehicle");

    if (vehicle) {
      vehicle.style.transform =
        "rotate(" + heading + "deg)";
    }

  }
}

function updateGPS(lat, lng) {

  if (!gpsMarker) {

    gpsMarker = L.marker(
      [lat, lng],
      {
        icon: gpsIcon
      }
    ).addTo(map);

  } else {

    gpsMarker.setLatLng([lat, lng]);

  }
}

document.addEventListener(
  "message",
  handleMessage
);

window.addEventListener(
  "message",
  handleMessage
);

function handleMessage(event) {

  try {

    const data =
      JSON.parse(event.data);

    if (data.type === "vehicle_position") {

      updateVehicle(
        data.lat,
        data.lng,
        data.heading || 0
      );

    }

    if (data.type === "phone_gps") {

      updateGPS(
        data.lat,
        data.lng
      );

    }

  } catch (e) {

    console.log(e);

  }

}

</script>

</body>
</html>
`;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },

    header: {
        padding: 15,
        backgroundColor: "#111827",
    },

    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
    },

    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
    },

    dot: {
        width: 9,
        height: 9,
        borderRadius: 10,
        marginRight: 7,
    },

    status: {
        color: "#d1d5db",
        fontSize: 12,
    },

    mapContainer: {
        flex: 1,
    },

    loading: {
        position: "absolute",
        alignSelf: "center",
        top: "45%",
        backgroundColor: "white",
        padding: 20,
        borderRadius: 10,
        alignItems: "center",
        gap: 8,
    },

    footer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: "#ddd",
    },
});