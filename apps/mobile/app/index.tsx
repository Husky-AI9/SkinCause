import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage, useMobile } from "../src/mobile-provider";
import { colors, Notice } from "../src/ui";

const metrics = [
  { icon: "scan-outline", value: "AI", label: "visible acne-pattern scan" },
  { icon: "wallet-outline", value: "≤ $25", label: "demo product budget" },
  { icon: "flask-outline", value: "1", label: "change tested at a time" }
] as const;

const processSteps = [
  {
    number: "01",
    title: "Measure the acne pattern",
    detail: "YouCam records visible blemish, oiliness, redness, pore, and texture signals from a repeatable scan."
  },
  {
    number: "02",
    title: "Build an affordable plan",
    detail: "OpenAI organizes one budget-aware product action and conservative nutrition context from sourced information."
  },
  {
    number: "03",
    title: "Visualize, then test",
    detail: "YouCam illustrates selected cosmetic changes while follow-up scans test the real pattern over time."
  }
];

export default function LandingScreen() {
  const router = useRouter();
  const { ready, signedIn, startDemo } = useMobile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openScan() {
    if (signedIn) {
      router.push("/scan");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await startDemo();
      router.push("/scan");
    } catch (entryError) {
      setError(errorMessage(entryError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={landingStyles.safeArea} edges={["top"]}>
      <ScrollView style={landingStyles.screen} contentContainerStyle={landingStyles.content}>
        <View style={landingStyles.topBar}>
          <View style={landingStyles.brand}>
            <View style={landingStyles.brandMark}>
              <Ionicons name="scan" color={colors.tealDark} size={22} />
            </View>
            <Text style={landingStyles.brandText}>SkinCause</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push((signedIn ? "/dashboard" : "/auth") as Href)}
            style={landingStyles.signInButton}
          >
            <Ionicons name={signedIn ? "person-circle-outline" : "log-in-outline"} color={colors.inkSoft} size={18} />
            <Text style={landingStyles.signInText}>{signedIn ? "My plan" : "Sign in"}</Text>
          </Pressable>
        </View>

        <View style={landingStyles.heroCopy}>
          <Text style={landingStyles.title}>A clearer acne plan.</Text>
          <Text style={landingStyles.offer}>AI skin analysis. Affordable products. Nutrition in context.</Text>
          <Text style={landingStyles.summary}>
            Measure visible acne-related patterns, get one budget-aware skincare action, and track whether the real measurements change without hiding uncertainty.
          </Text>
          {error ? <Notice danger>{error}</Notice> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={() => void openScan()}
            style={({ pressed }) => [landingStyles.primaryButton, (pressed || busy) && landingStyles.pressed]}
          >
            {!ready || busy ? <ActivityIndicator color={colors.white} /> : <Text style={landingStyles.primaryButtonText}>Start acne analysis</Text>}
            {ready && !busy ? <Ionicons name="arrow-forward" color={colors.white} size={19} /> : null}
          </Pressable>
        </View>

        <ImageBackground
          accessibilityLabel="Fictional adult prepared for a standardized cosmetic scan"
          imageStyle={landingStyles.heroImage}
          resizeMode="cover"
          source={require("../assets/landing-model.png")}
          style={landingStyles.faceStage}
        >
          <View style={[landingStyles.crosshair, landingStyles.crosshairHorizontal]} />
          <View style={[landingStyles.crosshair, landingStyles.crosshairVertical]} />
          <View style={[landingStyles.scanMarker, landingStyles.acneMarker]}>
            <Text style={landingStyles.markerLabel}>Acne pattern</Text>
            <Text style={landingStyles.markerValue}>60</Text>
          </View>
          <View style={[landingStyles.scanMarker, landingStyles.oilMarker]}>
            <Text style={landingStyles.markerLabel}>Oiliness</Text>
            <Text style={landingStyles.markerValue}>45</Text>
          </View>
          <View style={landingStyles.imageNote}><Text style={landingStyles.imageNoteText}>Fictional demo image</Text></View>
        </ImageBackground>

        <View style={landingStyles.metrics}>
          {metrics.map((metric) => (
            <View key={metric.label} style={landingStyles.metric}>
              <Ionicons name={metric.icon} color={colors.teal} size={19} />
              <Text style={landingStyles.metricValue}>{metric.value}</Text>
              <Text style={landingStyles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <View style={landingStyles.flowStrip}>
          {(["Acne scan", "Affordable plan", "Nutrition", "Simulation"] as const).map((label, index) => (
            <View key={label} style={landingStyles.flowItem}>
              {index > 0 ? <View style={landingStyles.flowDot} /> : null}
              <Text style={landingStyles.flowText}>{label}</Text>
            </View>
          ))}
        </View>

        <ImageBackground
          imageStyle={landingStyles.methodImage}
          resizeMode="cover"
          source={require("../assets/routine-editorial.png")}
          style={landingStyles.methodVisual}
        >
          <View style={landingStyles.visualLabel}>
            <Ionicons name="camera-outline" color={colors.tealDark} size={15} />
            <Text style={landingStyles.visualLabelText}>Acne baseline recorded</Text>
          </View>
        </ImageBackground>

        <View style={landingStyles.methodCopy}>
          <Text style={landingStyles.kicker}>An acne-first AI guidance loop</Text>
          <Text style={landingStyles.sectionTitle}>Scan. Recommend. Simulate. Verify.</Text>
          <Text style={landingStyles.summary}>
            SkinCause keeps the OpenAI guidance, YouCam illustration, and real follow-up evidence in one understandable journey.
          </Text>
          <View style={landingStyles.processList}>
            {processSteps.map((step) => (
              <View key={step.number} style={landingStyles.processStep}>
                <Text style={landingStyles.stepNumber}>{step.number}</Text>
                <View style={landingStyles.stepCopy}>
                  <Text style={landingStyles.stepTitle}>{step.title}</Text>
                  <Text style={landingStyles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={landingStyles.statement}>
          <View style={landingStyles.tags}>
            {(["Acne focused", "Affordable", "Nutrition tracked", "Uncertainty visible"] as const).map((tag) => (
              <View key={tag} style={landingStyles.tag}><Text style={landingStyles.tagText}>{tag}</Text></View>
            ))}
          </View>
          <Text style={landingStyles.kicker}>Guidance without overclaiming</Text>
          <Text style={landingStyles.statementTitle}>See the acne pattern. Choose one accessible action. Measure what happens next.</Text>
          <Text style={landingStyles.statementBody}>
            SkinCause measures cosmetic acne-related signals and organizes sourced guidance. It does not diagnose acne, prescribe treatment, or promise that a product or diet will improve skin.
          </Text>
        </View>

        <View style={landingStyles.finalCard}>
          <Text style={landingStyles.kicker}>Your image. Your timeline. Your control.</Text>
          <Text style={landingStyles.finalTitle}>Try the acne scan, affordable recommendation, and simulation journey.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={() => void openScan()}
            style={({ pressed }) => [landingStyles.secondaryButton, pressed && landingStyles.pressed]}
          >
            <Text style={landingStyles.secondaryButtonText}>{signedIn ? "Continue to scan" : "Try the demo"}</Text>
            <Ionicons name="arrow-forward" color={colors.tealDark} size={19} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const landingStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 36 },
  topBar: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.seaGlass },
  brandText: { color: colors.ink, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  signInButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  signInText: { color: colors.inkSoft, fontSize: 14, fontWeight: "800" },
  heroCopy: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 22, gap: 13 },
  title: { color: colors.ink, fontSize: 43, lineHeight: 45, fontWeight: "900", letterSpacing: -1.8 },
  offer: { color: colors.coral, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  summary: { color: colors.inkSoft, fontSize: 15, lineHeight: 23 },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 5,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.teal
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  pressed: { opacity: 0.8 },
  faceStage: { height: 465, marginHorizontal: 16, justifyContent: "flex-end", overflow: "hidden", borderRadius: 24, backgroundColor: colors.seaGlass },
  heroImage: { borderRadius: 24 },
  crosshair: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
  crosshairHorizontal: { left: 0, right: 0, top: "47%", height: 1 },
  crosshairVertical: { top: 0, bottom: 0, left: "50%", width: 1 },
  scanMarker: { position: "absolute", minWidth: 90, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(16,47,51,0.9)" },
  acneMarker: { left: 18, top: 155 },
  oilMarker: { right: 18, top: 260 },
  markerLabel: { color: colors.white, fontSize: 10, fontWeight: "700" },
  markerValue: { color: colors.white, fontSize: 18, fontWeight: "900" },
  imageNote: { alignSelf: "flex-start", margin: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(255,253,248,0.9)" },
  imageNoteText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  metrics: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 18, gap: 8 },
  metric: { flex: 1, minHeight: 112, padding: 11, gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: colors.inkSoft, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  flowStrip: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 9, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: colors.tealDark },
  flowItem: { flexDirection: "row", alignItems: "center", gap: 9 },
  flowDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.aqua },
  flowText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  methodVisual: { height: 330, margin: 16, justifyContent: "flex-end", padding: 14, overflow: "hidden", borderRadius: 22 },
  methodImage: { borderRadius: 22 },
  visualLabel: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: "rgba(255,253,248,0.92)" },
  visualLabelText: { color: colors.tealDark, fontSize: 12, fontWeight: "900" },
  methodCopy: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 30, gap: 11 },
  kicker: { color: colors.teal, fontSize: 11, lineHeight: 16, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  sectionTitle: { color: colors.ink, fontSize: 31, lineHeight: 35, fontWeight: "900", letterSpacing: -1 },
  processList: { marginTop: 9 },
  processStep: { flexDirection: "row", gap: 14, paddingVertical: 17, borderTopWidth: 1, borderTopColor: colors.line },
  stepNumber: { width: 34, color: colors.coral, fontSize: 13, fontWeight: "900" },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  stepDetail: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  statement: { paddingHorizontal: 22, paddingVertical: 34, gap: 15, backgroundColor: colors.tealDark },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 99 },
  tagText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  statementTitle: { color: colors.white, fontSize: 31, lineHeight: 37, fontWeight: "900", letterSpacing: -0.8 },
  statementBody: { color: colors.aqua, fontSize: 14, lineHeight: 22 },
  finalCard: { margin: 16, padding: 22, gap: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  finalTitle: { color: colors.ink, fontSize: 24, lineHeight: 29, fontWeight: "900" },
  secondaryButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.teal, borderRadius: 13 },
  secondaryButtonText: { color: colors.tealDark, fontSize: 15, fontWeight: "900" }
});
