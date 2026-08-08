import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { tokens } from "@skincause/design-tokens";

export const colors = tokens.color;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  tone = "teal",
  style
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "teal" | "paper" | "coral";
  style?: StyleProp<ViewStyle>;
}) {
  const buttonStyle = tone === "paper" ? styles.paperButton : tone === "coral" ? styles.coralButton : styles.button;
  const labelStyle = tone === "paper" ? styles.paperButtonText : styles.buttonText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        buttonStyle,
        style,
        (pressed || disabled) && styles.buttonPressed,
        disabled && styles.buttonDisabled
      ]}
    >
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <View style={[styles.notice, danger && styles.noticeDanger]}><Text style={[styles.noticeText, danger && styles.noticeDangerText]}>{children}</Text></View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  hero: {
    backgroundColor: colors.seaGlass,
    padding: 22,
    borderRadius: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line
  },
  eyebrow: { color: colors.teal, fontWeight: "800", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  heroTitle: { color: colors.ink, fontSize: 31, fontWeight: "800", letterSpacing: -0.8 },
  heroBody: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  section: { backgroundColor: colors.white, borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, gap: 6 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  strong: { color: colors.ink, fontWeight: "800" },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  coralButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  paperButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.teal, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  paperButtonText: { color: colors.teal, fontWeight: "800", fontSize: 15 },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.45 },
  row: { flexDirection: "row", gap: 10 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionButton: { flex: 1, minHeight: 46 },
  studioTabs: {
    flexDirection: "row",
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paper
  },
  studioTab: { flex: 1, minHeight: 44, paddingHorizontal: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    minWidth: 98,
    flexGrow: 1,
    flexBasis: "30%",
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.seaGlass,
    gap: 4
  },
  metricValue: { color: colors.tealDark, fontSize: 23, fontWeight: "800" },
  metricLabel: { color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  notice: { borderRadius: 10, padding: 12, backgroundColor: colors.seaGlass },
  noticeDanger: { backgroundColor: "#fde5df" },
  noticeText: { color: colors.tealDark, fontSize: 13, lineHeight: 19 },
  noticeDangerText: { color: "#9c341f" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.seaGlass },
  pillText: { color: colors.tealDark, fontWeight: "700", fontSize: 12 },
  image: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: colors.seaGlass },
  productImage: {
    width: "100%",
    height: 160,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white
  },
  divider: { height: 1, backgroundColor: colors.line },
  concernList: { gap: 4 },
  concernRow: {
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  concernHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  concernLabel: { flex: 1, color: colors.ink, fontWeight: "800", fontSize: 14 },
  concernScore: {
    width: 40,
    color: colors.tealDark,
    fontWeight: "800",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "right"
  },
  concernTrack: { height: 8, borderRadius: 99, overflow: "hidden", backgroundColor: colors.canvas },
  concernFill: { height: "100%", borderRadius: 99, backgroundColor: colors.coral },
  changeCard: {
    padding: 15,
    gap: 4,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
    backgroundColor: "#fff4ef"
  },
  evidenceHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.seaGlass
  },
  evidenceThumbnail: {
    width: 96,
    height: 112,
    borderRadius: 10,
    backgroundColor: colors.canvas
  },
  evidenceHeroCopy: { flex: 1, minWidth: 0, gap: 5 },
  smallLabel: {
    color: colors.inkSoft,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas
  },
  tagText: { color: colors.tealDark, fontWeight: "700", fontSize: 12 },
  productRow: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  productInfo: { minWidth: 0, flex: 1, gap: 2 },
  statusActive: { color: colors.teal, fontWeight: "800", fontSize: 12 },
  statusPaused: { color: colors.coral, fontWeight: "800", fontSize: 12 },
  nutritionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  nutritionCard: {
    width: "48%",
    minHeight: 118,
    padding: 13,
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.canvas
  },
  nutritionAmount: { color: colors.coral, fontWeight: "800", fontSize: 20 },
  nutritionFood: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  nutritionServing: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  finePrint: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  dangerSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e8b8ae"
  },
  simulationFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.seaGlass
  },
  simulationImage: { position: "absolute", width: "100%", height: "100%" },
  simulationAfterClip: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
  simulationDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.white
  },
  simulationHandle: {
    position: "absolute",
    top: "50%",
    left: -16,
    width: 34,
    height: 34,
    marginTop: -17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 99,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.teal
  },
  simulationHandleText: { color: colors.white, fontWeight: "900" },
  simulationLabel: {
    position: "absolute",
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    color: colors.white,
    backgroundColor: "rgba(8, 51, 54, 0.84)",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden"
  },
  beforeLabel: { right: 10 },
  afterLabel: { left: 10 },
  simulationTouchLayer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  centered: { alignItems: "center", justifyContent: "center" }
});
