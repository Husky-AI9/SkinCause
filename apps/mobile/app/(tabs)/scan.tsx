import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import type { LocalImageAsset, Scan } from "@skincause/contracts";
import { apiOrigin } from "../../src/config";
import { errorMessage, useMobile } from "../../src/mobile-provider";
import { colors, Notice, PrimaryButton, Section, styles } from "../../src/ui";

const preparedImageUri = `${apiOrigin}/images/demo-face-acne.png`;
const concernOrder = [
  "blemish_pattern",
  "redness",
  "texture",
  "pores",
  "oiliness",
  "hydration",
  "radiance"
];

function orderedConcerns(scan: Scan) {
  return [...scan.concerns].sort((left, right) => {
    const leftIndex = concernOrder.indexOf(left.key);
    const rightIndex = concernOrder.indexOf(right.key);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
}

function initialConcernKey(scan: Scan) {
  return orderedConcerns(scan).find((concern) => concern.maskUrl)?.key ?? null;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ScanScreen() {
  const router = useRouter();
  const {
    activeScanId,
    uploadAndSubmit,
    getScan,
    clearActiveScan,
    saveLatestScan
  } = useMobile();
  const [asset, setAsset] = useState<LocalImageAsset | null>(null);
  const [status, setStatus] = useState<string>(activeScanId ? "processing" : "ready");
  const [result, setResult] = useState<Scan | null>(null);
  const [activeConcern, setActiveConcern] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const imageUri = asset?.uri;
  const processing = ["queued", "processing", "task_created", "uploaded"].includes(status);
  const availableMasks = useMemo(
    () => (result ? orderedConcerns(result).filter((concern) => concern.maskUrl) : []),
    [result]
  );
  const activeMask = availableMasks.find((concern) => concern.key === activeConcern);

  useEffect(() => {
    if (!activeScanId || !processing) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const update = await getScan(activeScanId);
        if (!active) return;
        setStatus(update.status);
        if (update.status === "succeeded" || update.status === "normalized") {
          const completed = (update.result as Scan | undefined) ?? null;
          setResult(completed);
          setActiveConcern(completed ? initialConcernKey(completed) : null);
          if (completed) await saveLatestScan(completed);
          await clearActiveScan();
          return;
        }
        if (update.status.includes("failed") || update.status === "timed_out") {
          setError(update.error?.message ?? "The scan could not be completed.");
          return;
        }
        timer = setTimeout(() => void poll(), update.pollAfterMs ?? 2000);
      } catch (pollError) {
        if (active) setError(errorMessage(pollError));
      }
    };
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void poll();
    });
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      appState.remove();
    };
  }, [activeScanId, clearActiveScan, getScan, processing, saveLatestScan]);

  async function pickImage(source: "camera" | "library") {
    setError("");
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo permission is needed only to select the image you want to scan.");
      return;
    }
    const picked =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.9
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.9
          });
    if (picked.canceled) return;
    const image = picked.assets[0];
    const mimeType = image.mimeType === "image/png" ? "image/png" : "image/jpeg";
    setAsset({
      uri: image.uri,
      mimeType,
      width: image.width,
      height: image.height,
      byteSize: image.fileSize,
      fileName: image.fileName ?? undefined
    });
    setStatus("ready");
    setResult(null);
    setActiveConcern(null);
  }

  function usePreparedImage() {
    setError("");
    setAsset({
      uri: preparedImageUri,
      mimeType: "image/png",
      width: 1254,
      height: 1254,
      fileName: "skincause-acne-demo.png"
    });
    setStatus("ready");
    setResult(null);
    setActiveConcern(null);
  }

  async function submit() {
    if (!asset) return;
    setBusy(true);
    setError("");
    try {
      const started = await uploadAndSubmit(asset);
      setStatus(started.status);
      if (started.status === "succeeded" || started.status === "normalized") {
        const completed = (started.result as Scan | undefined) ?? null;
        setResult(completed);
        setActiveConcern(completed ? initialConcernKey(completed) : null);
        if (completed) await saveLatestScan(completed);
        await clearActiveScan();
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
      setStatus("ready");
    } finally {
      setBusy(false);
    }
  }

  const concernRows = useMemo(
    () => (result ? orderedConcerns(result).slice(0, 5) : []),
    [result]
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Repeatable capture</Text>
        <Text style={styles.heroTitle}>Center. Light. Compare.</Text>
        <Text style={styles.heroBody}>
          Use the same camera, neutral expression, and even front lighting for each measurement.
        </Text>
      </View>

      {imageUri ? (
        <>
          <View style={scanStyles.imageFrame}>
            <Image
              source={{ uri: imageUri }}
              style={scanStyles.layeredImage}
              resizeMode="cover"
              accessibilityLabel={
                activeMask
                  ? `${activeMask.displayLabel ?? activeMask.providerLabel} visual pattern overlay`
                  : "Selected cosmetic scan image"
              }
            />
            {activeMask?.maskUrl ? (
              <Image
                source={{ uri: activeMask.maskUrl }}
                style={scanStyles.layeredImage}
                resizeMode="cover"
                accessibilityElementsHidden
              />
            ) : null}
            {result ? (
              <View style={scanStyles.imageLabel}>
                <Text style={scanStyles.imageLabelText}>
                  {activeMask
                    ? `${activeMask.displayLabel ?? activeMask.providerLabel} overlay`
                    : "Original image"}
                </Text>
              </View>
            ) : null}
          </View>

          {result ? (
            <Section title="Facial segmentation">
              {availableMasks.length > 0 ? (
                <>
                  <Text style={styles.body}>
                    Select a measurement to view its provider mask on the analyzed image.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={scanStyles.controlRow}
                    accessibilityRole="tablist"
                  >
                    <SegmentationButton
                      label="Original"
                      selected={activeConcern === null}
                      onPress={() => setActiveConcern(null)}
                    />
                    {availableMasks.map((concern) => (
                      <SegmentationButton
                        key={concern.key}
                        label={concern.displayLabel ?? concern.providerLabel}
                        selected={activeConcern === concern.key}
                        onPress={() => setActiveConcern(concern.key)}
                        withSwatch
                      />
                    ))}
                  </ScrollView>
                  <Text style={styles.finePrint}>
                    {availableMasks.length} provider mask{" "}
                    {availableMasks.length === 1 ? "overlay" : "overlays"} available.
                  </Text>
                </>
              ) : (
                <Notice>
                  Location data was not returned for this scan. Scores remain available.
                </Notice>
              )}
            </Section>
          ) : null}
        </>
      ) : null}

      <Section title="Choose an image">
        <PrimaryButton label="Use acne demo image" onPress={usePreparedImage} />
        <View style={styles.actionRow}>
          <PrimaryButton
            label="Take photo"
            tone="paper"
            style={styles.actionButton}
            onPress={() => void pickImage("camera")}
          />
          <PrimaryButton
            label="Gallery"
            tone="paper"
            style={styles.actionButton}
            onPress={() => void pickImage("library")}
          />
        </View>
      </Section>

      <Section title="Scan status">
        <View style={styles.pill}>
          <Text style={styles.pillText}>{formatStatus(status)}</Text>
        </View>
        {processing || busy ? <ActivityIndicator /> : null}
        <Text style={styles.body}>
          {processing
            ? "SkinCause will resume this same task if the app is interrupted."
            : "The image is sent only after you select Analyze image."}
        </Text>
        {error ? <Notice danger>{error}</Notice> : null}
        <PrimaryButton
          label={
            busy
              ? "Starting scan…"
              : processing
                ? "Scan in progress"
                : "Analyze image"
          }
          disabled={!asset || busy || processing}
          onPress={() => void submit()}
        />
      </Section>

      {result ? (
        <Section title="Visible skin measurements">
          <View style={styles.concernList}>
            {concernRows.map((concern) => {
              const severity = concern.normalizedSeverity ?? 0;
              return (
                <View key={concern.key} style={styles.concernRow}>
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
          <PrimaryButton
            label="Use scan in experiment"
            onPress={() => router.push("/experiment")}
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

function SegmentationButton({
  label,
  selected,
  onPress,
  withSwatch = false
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  withSwatch?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        scanStyles.control,
        selected && scanStyles.controlSelected,
        pressed && scanStyles.controlPressed
      ]}
    >
      {withSwatch ? (
        <View style={[scanStyles.swatch, selected && scanStyles.swatchSelected]} />
      ) : null}
      <Text style={[scanStyles.controlText, selected && scanStyles.controlTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const scanStyles = StyleSheet.create({
  imageFrame: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.seaGlass
  },
  layeredImage: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%"
  },
  imageLabel: {
    position: "absolute",
    left: 12,
    bottom: 12,
    maxWidth: "88%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "rgba(8, 51, 54, 0.84)"
  },
  imageLabelText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800"
  },
  controlRow: {
    gap: 8,
    paddingRight: 4
  },
  control: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 99,
    backgroundColor: colors.canvas
  },
  controlSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.teal
  },
  controlPressed: {
    opacity: 0.8
  },
  controlText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: "800"
  },
  controlTextSelected: {
    color: colors.white
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: colors.coral
  },
  swatchSelected: {
    borderWidth: 1,
    borderColor: colors.white
  }
});
