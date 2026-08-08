import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type {
  Experiment,
  RoutineRecommendation,
  SkinSimulation
} from "@skincause/contracts";
import {
  getVisibleAcnePatternAssessment,
  scans,
  seededExperiment,
  skinSimulationDisclaimer,
  summarizeScanReadiness
} from "@skincause/domain";
import { apiOrigin } from "../../src/config";
import { servingForFood } from "../../src/nutrition";
import { errorMessage, useMobile } from "../../src/mobile-provider";
import { Notice, PrimaryButton, Section, styles } from "../../src/ui";

const demoExperimentId = "brightening-serum-elimination";
const demoBeforeUri = `${apiOrigin}/images/demo-face-acne.png`;

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ComparisonSlider({
  beforeUri,
  afterUri,
  imageHeaders
}: {
  beforeUri: string;
  afterUri: string;
  imageHeaders: Record<string, string>;
}) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [position, setPosition] = useState(0.5);

  function updatePosition(event: GestureResponderEvent) {
    if (frameWidth <= 0) return;
    const next = Math.max(0, Math.min(1, event.nativeEvent.locationX / frameWidth));
    setPosition(next);
  }

  function recordWidth(event: LayoutChangeEvent) {
    setFrameWidth(event.nativeEvent.layout.width);
  }

  const imageSource = {
    uri: afterUri,
    ...(Object.keys(imageHeaders).length > 0 ? { headers: imageHeaders } : {})
  };
  const beforeImageSource = {
    uri: beforeUri,
    ...(Object.keys(imageHeaders).length > 0 ? { headers: imageHeaders } : {})
  };

  return (
    <View
      style={styles.simulationFrame}
      onLayout={recordWidth}
      accessibilityLabel="Before and after skin simulation comparison"
    >
      <Image source={beforeImageSource} style={styles.simulationImage} resizeMode="cover" />
      <View style={[styles.simulationAfterClip, { width: frameWidth * position }]}>
        {frameWidth > 0 ? (
          <Image
            source={imageSource}
            style={{ width: frameWidth, height: frameWidth }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <Text style={[styles.simulationLabel, styles.afterLabel]}>AFTER</Text>
      <Text style={[styles.simulationLabel, styles.beforeLabel]}>BEFORE</Text>
      <View
        pointerEvents="none"
        style={[styles.simulationDivider, { left: frameWidth * position }]}
      >
        <View style={styles.simulationHandle}>
          <Text style={styles.simulationHandleText}>↔</Text>
        </View>
      </View>
      <View
        style={styles.simulationTouchLayer}
        accessibilityRole="adjustable"
        accessibilityLabel="Before and after comparison position"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(position * 100) }}
        accessibilityActions={[
          { name: "increment", label: "Show more of the after image" },
          { name: "decrement", label: "Show more of the before image" }
        ]}
        onAccessibilityAction={(event) => {
          setPosition((current) =>
            event.nativeEvent.actionName === "increment"
              ? Math.min(1, current + 0.1)
              : Math.max(0, current - 0.1)
          );
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updatePosition}
        onResponderMove={updatePosition}
      />
    </View>
  );
}

export default function ExperimentScreen() {
  const router = useRouter();
  const {
    deleteSkinSimulation,
    generateRoutineRecommendation,
    getRoutineRecommendation,
    getSkinSimulation,
    imageHeaders,
    listExperiments,
    startSkinSimulation
  } = useMobile();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [recommendation, setRecommendation] = useState<RoutineRecommendation | null>(null);
  const [simulation, setSimulation] = useState<SkinSimulation | null>(null);
  const [activeStudio, setActiveStudio] = useState<"plan" | "simulation">("plan");
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [productImageFailed, setProductImageFailed] = useState(false);
  const [error, setError] = useState("");

  const experimentId = experiment?.id ?? demoExperimentId;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const experiments = await listExperiments();
          const selected =
            experiments.find((item) => item.status === "active") ??
            experiments[0] ??
            null;
          const selectedId = selected?.id ?? demoExperimentId;
          const [savedRecommendation, savedSimulation] = await Promise.all([
            getRoutineRecommendation(selectedId).catch(() => null),
            getSkinSimulation(selectedId).catch(() => null)
          ]);
          if (!active) return;
          setExperiment(selected);
          setRecommendation(savedRecommendation);
          setSimulation(savedSimulation);
        } catch (loadError) {
          if (active) setError(errorMessage(loadError));
        }
      })();
      return () => {
        active = false;
      };
    }, [getRoutineRecommendation, getSkinSimulation, listExperiments])
  );

  useEffect(() => {
    if (simulation?.status !== "queued" && simulation?.status !== "processing") return;
    const timer = setTimeout(() => {
      void getSkinSimulation(experimentId)
        .then((updated) => {
          setSimulation(updated);
          if (updated?.status === "failed") {
            setError(updated.error?.message ?? "The illustration could not be generated.");
          }
        })
        .catch((pollError: unknown) => setError(errorMessage(pollError)));
    }, simulation.pollAfterMs ?? 2000);
    return () => clearTimeout(timer);
  }, [experimentId, getSkinSimulation, simulation]);

  async function generateSuggestion() {
    setActiveStudio("plan");
    setRecommendationBusy(true);
    setProductImageFailed(false);
    setError("");
    try {
      setRecommendation(await generateRoutineRecommendation(experimentId));
    } catch (recommendationError) {
      setError(errorMessage(recommendationError));
    } finally {
      setRecommendationBusy(false);
    }
  }

  async function generateSimulation() {
    setActiveStudio("simulation");
    setSimulationBusy(true);
    setError("");
    try {
      if (simulation?.status === "succeeded") {
        await deleteSkinSimulation(experimentId);
      }
      setSimulation(await startSkinSimulation(experimentId));
    } catch (simulationError) {
      setError(errorMessage(simulationError));
    } finally {
      setSimulationBusy(false);
    }
  }

  const displayedExperiment = experiment ?? seededExperiment;
  const result = displayedExperiment.result ?? seededExperiment.result;
  const baseline = scans[0];
  const readiness = summarizeScanReadiness(baseline);
  const acneAssessment = getVisibleAcnePatternAssessment(baseline);
  const afterUri = simulation?.imageUrl
    ? simulation.imageUrl.startsWith("http")
      ? simulation.imageUrl
      : `${apiOrigin}${simulation.imageUrl}`
    : null;
  const beforeUri =
    simulation?.sourceScanId && Object.keys(imageHeaders).length > 0
      ? `${apiOrigin}/api/v1/scans/${encodeURIComponent(simulation.sourceScanId)}/image`
      : demoBeforeUri;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AI experiment studio</Text>
        <Text style={styles.heroTitle}>One product, one measurable goal.</Text>
        <Text style={styles.heroBody}>
          Apply an affordable product action, track food servings, and preview a YouCam
          illustration from the same acne baseline.
        </Text>
      </View>

      {error ? <Notice danger>{error}</Notice> : null}

      <Section title="Experiment evidence card">
        <View style={styles.evidenceHeroRow}>
          <Image
            source={{ uri: demoBeforeUri }}
            style={styles.evidenceThumbnail}
            resizeMode="cover"
            accessibilityLabel="Synthetic acne-visible portrait used for this demo scan and simulation"
          />
          <View style={styles.evidenceHeroCopy}>
            <Text style={styles.smallLabel}>Same scan source</Text>
            <Text style={styles.cardTitle}>One change. One comparable baseline.</Text>
            <Text style={styles.body}>{readiness.label} · {readiness.score}/100 capture readiness</Text>
            <Text style={styles.body}>
              Acne severity {acneAssessment.severity?.normalizedSeverity ?? "—"}/100 · {acneAssessment.visiblePattern ?? "Unclassified visible acne pattern"}
            </Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>14</Text>
            <Text style={styles.metricLabel}>day observation</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{recommendation?.measurementKeys.length ?? 3}</Text>
            <Text style={styles.metricLabel}>locked signals</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{simulation?.status === "succeeded" ? "Yes" : "No"}</Text>
            <Text style={styles.metricLabel}>illustration generated</Text>
          </View>
        </View>
        {readiness.note ? <Text style={styles.finePrint}>{readiness.note}</Text> : null}
      </Section>

      <View style={styles.studioTabs}>
        <PrimaryButton
          label="Product + nutrition"
          tone={activeStudio === "plan" ? "teal" : "paper"}
          style={styles.studioTab}
          onPress={() => setActiveStudio("plan")}
        />
        <PrimaryButton
          label="Skin simulation"
          tone={activeStudio === "simulation" ? "teal" : "paper"}
          style={styles.studioTab}
          onPress={() => setActiveStudio("simulation")}
        />
      </View>

      {activeStudio === "plan" ? (
        <Section title="Affordable product guidance">
          {recommendation ? (
            <>
              <View style={styles.changeCard}>
                <Text style={styles.smallLabel}>{titleCase(recommendation.action)}</Text>
                <Text style={styles.cardTitle}>{recommendation.summary}</Text>
              </View>
              {recommendation.existingProductName ? (
                <Text style={styles.body}>
                  Current product: {recommendation.existingProductName}
                </Text>
              ) : null}
              {recommendation.candidateProduct ? (
                <View style={styles.card}>
                  {recommendation.candidateProduct.imageUrl && !productImageFailed ? (
                    <Image
                      source={{ uri: recommendation.candidateProduct.imageUrl }}
                      style={styles.productImage}
                      resizeMode="contain"
                      accessibilityLabel={`${recommendation.candidateProduct.brand} ${recommendation.candidateProduct.name}`}
                      onError={() => setProductImageFailed(true)}
                    />
                  ) : null}
                  <Text style={styles.smallLabel}>Suggested candidate</Text>
                  <Text style={styles.cardTitle}>
                    {recommendation.candidateProduct.brand}{" "}
                    {recommendation.candidateProduct.name}
                  </Text>
                  <Text style={styles.body}>
                    {recommendation.candidateProduct.category}
                    {recommendation.candidateProduct.estimatedPrice
                      ? ` · ${recommendation.candidateProduct.estimatedPrice}`
                      : ""}
                  </Text>
                  {recommendation.candidateProduct.packageSize ? (
                    <Text style={styles.body}>
                      {recommendation.candidateProduct.packageSize}
                      {recommendation.candidateProduct.pricePerUnit
                        ? ` · ${recommendation.candidateProduct.pricePerUnit}`
                        : ""}
                    </Text>
                  ) : null}
                  {recommendation.candidateProduct.priceCheckedAt ? (
                    <Text style={styles.finePrint}>
                      Price checked {new Date(recommendation.candidateProduct.priceCheckedAt).toLocaleDateString()}; verify before buying.
                    </Text>
                  ) : null}
                  {recommendation.candidateProduct.localAvailability ? (
                    <Text style={styles.body}>
                      {recommendation.candidateProduct.localAvailability}
                    </Text>
                  ) : null}
                  {recommendation.candidateProduct.keyIngredients.length > 0 ? (
                    <Text style={styles.body}>
                      Label highlights: {recommendation.candidateProduct.keyIngredients.join(", ")}
                    </Text>
                  ) : null}
                  {recommendation.candidateProduct.usageNote ? (
                    <Notice>{recommendation.candidateProduct.usageNote}</Notice>
                  ) : null}
                  {recommendation.candidateProduct.lowerCostAlternative ? (
                    <Text style={styles.finePrint}>
                      Lower-cost option: {recommendation.candidateProduct.lowerCostAlternative}
                    </Text>
                  ) : null}
                  {recommendation.candidateProduct.productUrl ? (
                    <PrimaryButton
                      label="View product online"
                      tone="paper"
                      onPress={() =>
                        void Linking.openURL(recommendation.candidateProduct!.productUrl!)
                      }
                    />
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.smallLabel}>Queue as a later nutrition experiment</Text>
              <View style={styles.nutritionGrid}>
                {recommendation.nutritionGuidance.foodsToConsider.map((food) => (
                  <View style={styles.nutritionCard} key={food}>
                    <Text style={styles.nutritionAmount}>{servingForFood(food)}</Text>
                    <Text style={styles.nutritionFood}>{food}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.finePrint}>
                {recommendation.nutritionGuidance.evidenceNote}
              </Text>
              <Notice>
                Keep meals stable during this product experiment. Test one food habit separately later.
              </Notice>
              <View style={styles.tagRow}>
                {recommendation.measurementKeys.map((key) => (
                  <View style={styles.tag} key={key}>
                    <Text style={styles.tagText}>{key.replaceAll("_", " ")}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.body}>
              Generate one sourced add, remove, replace, or keep action using the recorded
              experiment and a demo budget of $25.
            </Text>
          )}
          <PrimaryButton
            label={recommendationBusy ? "Applying suggestion…" : "AI routine suggestion"}
            disabled={recommendationBusy}
            onPress={() => void generateSuggestion()}
          />
        </Section>
      ) : (
        <Section title="YouCam skin simulation">
          {simulation?.status === "succeeded" && afterUri ? (
            <>
              <ComparisonSlider
                beforeUri={beforeUri}
                afterUri={afterUri}
                imageHeaders={imageHeaders}
              />
              <Text style={styles.body}>Drag across the image to compare before and after.</Text>
            </>
          ) : simulation?.status === "queued" || simulation?.status === "processing" ? (
            <View style={[styles.card, styles.centered]}>
              <ActivityIndicator />
              <Text style={styles.body}>YouCam is generating the illustration…</Text>
            </View>
          ) : (
            <Text style={styles.body}>
              The before image is the same acne-visible demo portrait used on the Scan tab.
              The after image appears only after you generate it.
            </Text>
          )}
          <Text style={styles.finePrint}>
            {simulation?.disclaimer ?? skinSimulationDisclaimer}
          </Text>
          <PrimaryButton
            label={
              simulationBusy
                ? "Starting…"
                : simulation?.status === "succeeded"
                  ? "Regenerate illustration"
                  : "Generate illustration"
            }
            disabled={
              simulationBusy ||
              simulation?.status === "queued" ||
              simulation?.status === "processing"
            }
            onPress={() => void generateSimulation()}
          />
        </Section>
      )}

      <Section title="Experiment evidence">
        <View style={styles.pill}>
          <Text style={styles.pillText}>{result.associationLevel} association</Text>
        </View>
        <Text style={styles.cardTitle}>{result.wording}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{result.components.imageTrend}</Text>
            <Text style={styles.metricLabel}>image trend</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{result.components.adherence}</Text>
            <Text style={styles.metricLabel}>adherence</Text>
          </View>
        </View>
      </Section>

      <Section title="Check-ins">
        {displayedExperiment.checkIns.map((checkIn) => (
          <View key={checkIn.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {"day" in checkIn ? `Day ${checkIn.day}` : "Check-in"} ·{" "}
              {"date" in checkIn
                ? checkIn.date
                : new Date(checkIn.occurredAt).toLocaleDateString()}
            </Text>
            <Text style={styles.body}>
              Adherence {checkIn.adherence}% · observation {checkIn.observation}/10
            </Text>
          </View>
        ))}
      </Section>

      <PrimaryButton
        label="Capture comparable follow-up"
        tone="paper"
        onPress={() => router.push("/scan")}
      />
    </ScrollView>
  );
}
