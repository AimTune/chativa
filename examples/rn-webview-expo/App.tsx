import { useRef } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChativaWebView, sendToChativaWebView, type ChativaConnectorSpec } from "@chativa/rn-webview";
import type WebView from "react-native-webview";

// Flip to true to run against a mekik dev server instead of the zero-infra
// dummy connector. A device or emulator can't reach your machine's
// `localhost` — use your LAN IP (or `10.0.2.2` on the Android emulator).
const USE_MEKIK = false;
const MEKIK_URL = "ws://192.168.1.10:8790/chat";

const connector: ChativaConnectorSpec = USE_MEKIK
  ? {
      type: "mekik",
      options: {
        url: MEKIK_URL,
        resumeConversation: true,
        // Auth is *described*, not passed: this plain object is rebuilt into a
        // real TokenAuth instance inside the WebView (class instances can't
        // cross the JSON bridge). Drop it for servers that don't authenticate.
        auth: { kind: "token", token: "dev-token" },
      },
    }
  : { type: "dummy", options: { replyDelay: 500, connectDelay: 0 } };

export default function App() {
  const webViewRef = useRef<WebView>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>@chativa/rn-webview example</Text>
        <Text style={styles.subtitle}>
          ChativaWebView embeds the same web widget used by @chativa/react —
          the connector runs entirely inside the WebView's own browser
          engine, so DummyConnector (and any @chativa/connector-* package,
          including mekik with its server-defined GenUI components) works
          completely unmodified.
        </Text>
        <View style={styles.buttonRow}>
          <Button
            title="Dark theme"
            onPress={() =>
              // Live commands after mount go through the bridge, not a prop
              // change — changing connector/theme props would fully reload
              // the WebView and reconnect. See the package README.
              sendToChativaWebView(webViewRef, {
                type: "set_theme",
                payload: { colors: { primary: "#111827" } },
              })
            }
          />
          <Button
            title="Say hi"
            onPress={() =>
              sendToChativaWebView(webViewRef, {
                type: "send_message",
                payload: { text: "Hello from native!" },
              })
            }
          />
          <Button
            title="Open"
            onPress={() => sendToChativaWebView(webViewRef, { type: "open_widget" })}
          />
          <Button
            title="Close"
            onPress={() => sendToChativaWebView(webViewRef, { type: "close_widget" })}
          />
        </View>
      </View>

      <ChativaWebView
        ref={webViewRef}
        style={styles.webview}
        connector={connector}
        theme={{ colors: { primary: "#7c3aed", secondary: "#4f46e5" } }}
        onReady={() => console.log("[chativa] bridge ready")}
        onMessage={(message) => console.log("[chativa] message received:", message)}
        onMessageSent={(message) => console.log("[chativa] message sent:", message)}
        onConnect={() => console.log("[chativa] connector connected")}
        // Server-defined GenUI components (mekik `genui_components` frames)
        // render inside the WebView; these callbacks let native code observe
        // the catalog registration and each stream's lifecycle.
        onGenUIComponentsRegistered={({ components }) =>
          console.log("[chativa] genui catalog registered:", components)
        }
        onGenUIStreamStarted={({ streamId }) => console.log("[chativa] genui stream started:", streamId)}
        onGenUIStreamCompleted={({ streamId }) => console.log("[chativa] genui stream completed:", streamId)}
        onToolCallUpdated={(toolCall) => console.log("[chativa] tool call:", toolCall)}
        onAuthError={({ code, message }) => console.warn("[chativa] auth rejected:", code, message)}
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  webview: {
    flex: 1,
  },
});
