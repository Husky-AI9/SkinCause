import { useCallback, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { Experiment, Product, RoutineRecommendation } from "@skincause/contracts";
import {
  classifyCosmeticConcern,
  products as seededProducts,
  scans,
  seededExperiment
} from "@skincause/domain";
import { dailyNutritionTargets } from "../../src/nutrition";
import { errorMessage, useMobile } from "../../src/mobile-provider";
import { Notice, PrimaryButton, Section, styles } from "../../src/ui";

const concernOrder = ["blemish_pattern", "redness", "texture", "pores", "oiliness"];

export default function DashboardScreen() {
  const router = useRouter();
  const {
    demoMode,
    exitDemo,
    getRoutineRecommendation,
    latestScan,
    listExperiments,
    listProducts
  } = useMobile();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [routine, setRoutine] = useState<Product[]>(seededProducts);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [recommendation, setRecommendation] = useState<RoutineRecommendation | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const [loadedProducts, loadedExperiments] = await Promise.all([
            listProducts(),
            listExperiments()
          ]);
          if (!active) return;
          if (loadedProducts.length > 0) setRoutine(loadedProducts);
          const selectedExperiment =
            loadedExperiments.find((item) => item.status === "active") ??
              loadedExperiments[0] ??
              null;
          setExperiment(selectedExperiment);
          const loadedRecommendation = await getRoutineRecommendation(
            selectedExperiment?.id ?? "brightening-serum-elimination"
          ).catch(() => null);
          if (active) setRecommendation(loadedRecommendation);
        } catch (loadError) {
          if (active) setError(errorMessage(loadError));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [getRoutineRecommendation, listExperiments, listProducts])
  );

  const displayedScan = latestScan ?? scans[0];
  const concerns = [...displayedScan.concerns]
    .sort((left, right) => {
      const leftIndex = concernOrder.indexOf(left.key);
      const rightIndex = concernOrder.indexOf(right.key);
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    })
    .slice(0, 5);
  const acneConcern = concerns.find((concern) => concern.key === "blemish_pattern");
  const displayedExperiment = experiment ?? seededExperiment;
  const selectedProduct = routine.find(
    (product) => product.id === displayedExperiment.suspectProductId
  );
  const activeProducts = routine.filter((product) => product.active).length;
  const changeLabel = recommendation
    ? recommendation.action.replaceAll("_", " ")
    : displayedExperiment.type === "elimination"
      ? "Suspend one product"
      : "Introduce one product";
  const measurementKeys =
    recommendation?.measurementKeys ??
    experiment?.primaryConcerns ??
    ["blemish_pattern", "redness", "texture"];
  const nutritionMarker = "Nutrition context to track:";
  const experimentHypothesis = displayedExperiment.hypothesis
    .split(`\n\n${nutritionMarker}`)[0];
  const nutritionFocus = displayedExperiment.hypothesis.includes(nutritionMarker)
    ? displayedExperiment.hypothesis.split(nutritionMarker).at(-1)?.trim()
    : recommendation?.nutritionGuidance.suggestion ?? null;
  const recommendationProductName = recommendation?.candidateProduct
    ? `${recommendation.candidateProduct.brand} ${recommendation.candidateProduct.name}`
    : recommendation?.existingProductName;

  async function deleteData() {
    setDeleting(true);
    setError("");
    try {
      await exitDemo();
      router.replace("/");
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete all SkinCause data?",
      "This permanently removes the disposable account, scans, routine data, experiments, and generated images.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete data",
          style: "destructive",
          onPress: () => void deleteData()
        }
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          {demoMode ? "Disposable demo workspace" : "SkinCause workspace"}
        </Text>
        <Text style={styles.heroTitle}>Acne plan</Text>
        <Text style={styles.heroBody}>
          Your latest scan, one-variable experiment, routine, and daily nutrition targets.
        </Text>
        <View style={styles.actionRow}>
          <PrimaryButton
            label="New scan"
            tone="paper"
            style={styles.actionButton}
            onPress={() => router.push("/scan")}
          />
          <PrimaryButton
            label="Plan experiment"
            style={styles.actionButton}
            onPress={() => router.push("/experiment")}
          />
        </View>
      </View>

      {loading ? <ActivityIndicator /> : null}
      {error ? <Notice danger>{error}</Notice> : null}

      <View style={styles.statsGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{acneConcern?.normalizedSeverity ?? "—"}</Text>
          <Text style={styles.metricLabel}>
            {classifyCosmeticConcern(acneConcern?.normalizedSeverity ?? null).label}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{activeProducts}</Text>
          <Text style={styles.metricLabel}>active products</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{displayedExperiment.checkIns.length}</Text>
          <Text style={styles.metricLabel}>experiment check-ins</Text>
        </View>
      </View>

      <Section title="Latest scan measurements">
        <Text style={styles.body}>
          Captured{" "}
          {new Date(displayedScan.capturedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </Text>
        <View style={styles.concernList}>
          {concerns.map((concern) => {
            const severity = concern.normalizedSeverity ?? 0;
            return (
              <View style={styles.concernRow} key={concern.key}>
                <View style={styles.concernHeading}>
                  <Text style={styles.concernLabel}>
                    {concern.displayLabel ?? concern.providerLabel}
                  </Text>
                  <Text style={styles.concernScore}>{severity}</Text>
                </View>
                <View style={styles.concernTrack}>
                  <View style={[styles.concernFill, { width: `${severity}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="One planned change">
        <View style={styles.changeCard}>
          <Text style={styles.smallLabel}>{changeLabel}</Text>
          <Text style={styles.cardTitle}>
            {recommendationProductName ??
              experiment?.suspectProductName ??
              selectedProduct?.name ??
              "Selected routine product"}
          </Text>
        </View>
        <Text style={styles.smallLabel}>What you are measuring</Text>
        <Text style={styles.body}>{experimentHypothesis}</Text>
        <View style={styles.tagRow}>
          {measurementKeys.map((key) => (
            <View style={styles.tag} key={key}>
              <Text style={styles.tagText}>{key.replaceAll("_", " ")}</Text>
            </View>
          ))}
        </View>
        <PrimaryButton
          label="Open experiment studio"
          tone="paper"
          onPress={() => router.push("/experiment")}
        />
      </Section>

      <Section title="Products in this plan">
        {routine.map((product) => (
          <View style={styles.productRow} key={product.id}>
            <View style={styles.productInfo}>
              <Text style={styles.cardTitle}>{product.name}</Text>
              <Text style={styles.body}>
                {product.timeOfDay} · {product.cadence}
              </Text>
            </View>
            <Text style={product.active ? styles.statusActive : styles.statusPaused}>
              {product.active ? "Active" : "Paused"}
            </Text>
          </View>
        ))}
        <PrimaryButton
          label="Manage products"
          tone="paper"
          onPress={() => router.push("/products")}
        />
      </Section>

      <Section title="Daily nutrition plan">
        <Text style={styles.body}>
          Practical serving targets to keep nutrition observable while the experiment runs.
        </Text>
        {nutritionFocus ? (
          <Notice>
            Experiment nutrition focus: {nutritionFocus}
          </Notice>
        ) : null}
        <View style={styles.nutritionGrid}>
          {dailyNutritionTargets.map((target) => (
            <View style={styles.nutritionCard} key={target.food}>
              <Text style={styles.nutritionAmount}>{target.amount}</Text>
              <Text style={styles.nutritionFood}>{target.food}</Text>
              <Text style={styles.nutritionServing}>{target.serving}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.finePrint}>
          General food-serving targets only—not acne treatment or individualized nutrition advice.
          Adjust for allergies, medical needs, heat, and activity.
        </Text>
      </Section>

      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>Data controls</Text>
        <Text style={styles.body}>
          Permanently remove your routine, scans, experiments, check-ins, and account data.
        </Text>
        <PrimaryButton
          label={deleting ? "Deleting…" : "Delete my data"}
          tone="coral"
          disabled={deleting}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}
