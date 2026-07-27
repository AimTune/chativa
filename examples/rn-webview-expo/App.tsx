import { useRef } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChativaWebView, sendToChativaWebView } from "@chativa/rn-webview";
import type WebView from "react-native-webview";

export default function App() {
  const webViewRef = useRef<WebView>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>@chativa/rn-webview example</Text>
        <Text style={styles.subtitle}>
          ChativaWebView embeds the same web widget used by @chativa/react —
          the connector runs entirely inside the WebView's own browser
          engine, so DummyConnector (and any @chativa/connector-* package)
          works completely unmodified.
        </Text>
        <View style={styles.buttonRow}>
          <Button
            title="Set dark accent theme"
            onPress={() =>
              // Live theme update after mount goes through the bridge, not a
              // prop change — changing connector/theme props would fully
              // reload the WebView and reconnect. See the package README.
              sendToChativaWebView(webViewRef, {
                type: "set_theme",
                payload: { colors: { primary: "#111827" } },
              })
            }
          />
        </View>
      </View>

      <ChativaWebView
        ref={webViewRef}
        style={styles.webview}
        connector={{ type: "dummy", options: { replyDelay: 500, connectDelay: 0 } }}
        theme={{ colors: { primary: "#7c3aed", secondary: "#4f46e5" } }}
        onReady={() => console.log("[chativa] bridge ready")}
        onMessage={(message) => console.log("[chativa] message received:", message)}
        onMessageSent={(message) => console.log("[chativa] message sent:", message)}
        onConnect={() => console.log("[chativa] connector connected")}
        onError={(message) => console.warn("[chativa] bridge error:", message)}
      />

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#475569",
  },
  buttonRow: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  webview: {
    flex: 1,
  },
});
