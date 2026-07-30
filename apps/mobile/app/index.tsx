import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { errorMessage, useMobile } from "../src/mobile-provider";
import { Notice, PrimaryButton, styles } from "../src/ui";

export default function WelcomeScreen() {
  const router = useRouter();
  const { ready, startDemo, apiBaseUrl } = useMobile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enterDemo() {
    setBusy(true);
    setError("");
    try {
      await startDemo();
      router.replace("/dashboard");
    } catch (entryError) {
      setError(errorMessage(entryError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Android demo</Text>
        <Text style={styles.heroTitle}>A clearer acne plan.</Text>
        <Text style={styles.heroBody}>AI acne-pattern analysis, affordable product guidance, a quantified nutrition plan, and a before-and-after simulation.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan, guide, simulate, verify</Text>
        <Text style={styles.body}>Use the same SkinCause API as the web app. YouCam measures visible acne-related signals while product and nutrition guidance stays source-aware and testable.</Text>
        {error ? <Notice danger>{error}</Notice> : null}
        {!ready ? <ActivityIndicator /> : <PrimaryButton label={busy ? "Preparing demo…" : "Start Android demo"} disabled={busy} onPress={() => void enterDemo()} />}
      </View>
      <Notice>Demo API: {apiBaseUrl}. For an Android emulator using local web development, the fallback is 10.0.2.2:3000.</Notice>
    </ScrollView>
  );
}
