import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { errorMessage, useMobile } from "../src/mobile-provider";
import { colors, Notice, PrimaryButton, styles } from "../src/ui";

export default function AuthScreen() {
  const router = useRouter();
  const { ready, signIn, signUp } = useMobile();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
        router.replace("/dashboard");
        return;
      }
      const result = await signUp(email.trim(), password);
      if (result.confirmationRequired) {
        setMessage("Check your email to confirm the account, then return here to sign in.");
        setMode("sign-in");
      } else {
        router.replace("/dashboard");
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={authStyles.content} keyboardShouldPersistTaps="handled">
        <View style={authStyles.iconWrap}>
          <Ionicons name="lock-closed-outline" color={colors.teal} size={28} />
        </View>
        <Text style={styles.eyebrow}>Private workspace</Text>
        <Text style={authStyles.title}>
          {mode === "sign-in" ? "Sign in to SkinCause" : "Create your account"}
        </Text>
        <Text style={styles.body}>
          Use one account to keep normalized measurements available across supported clients.
        </Text>

        <View style={authStyles.tabs} accessibilityRole="tablist">
          {(["sign-in", "sign-up"] as const).map((item) => {
            const selected = mode === item;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={item}
                onPress={() => {
                  setMode(item);
                  setError("");
                  setMessage("");
                }}
                style={[authStyles.tab, selected && authStyles.tabSelected]}
              >
                <Text style={[authStyles.tabText, selected && authStyles.tabTextSelected]}>
                  {item === "sign-in" ? "Sign in" : "Create account"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={authStyles.form}>
          <Text style={authStyles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            style={styles.textInput}
            value={email}
          />
          <Text style={authStyles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            style={styles.textInput}
            value={password}
          />
        </View>

        {error ? <Notice danger>{error}</Notice> : null}
        {message ? <Notice>{message}</Notice> : null}
        {!ready ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <PrimaryButton
            disabled={busy || !email.trim() || password.length < 8}
            label={busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            onPress={() => void submit()}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const authStyles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  iconWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.seaGlass
  },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  tabs: {
    flexDirection: "row",
    padding: 4,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: colors.seaGlass
  },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  tabSelected: { backgroundColor: colors.white },
  tabText: { color: colors.inkSoft, fontSize: 14, fontWeight: "800" },
  tabTextSelected: { color: colors.tealDark },
  form: { gap: 8, marginTop: 4 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 4 }
});
