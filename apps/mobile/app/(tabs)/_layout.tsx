import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "../../src/ui";

export default function MainTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "800" },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          minHeight: 68,
          paddingTop: 7,
          paddingBottom: 9,
          borderTopColor: colors.line,
          backgroundColor: colors.paper
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800"
        }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Acne plan",
          tabBarLabel: "Acne plan",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={focused ? "clipboard" : "clipboard-outline"}
              size={size}
            />
          )
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "New scan",
          tabBarLabel: "Scan",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={focused ? "scan" : "scan-outline"}
              size={size}
            />
          )
        }}
      />
      <Tabs.Screen
        name="experiment"
        options={{
          title: "Experiment",
          tabBarLabel: "Experiment",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={focused ? "flask" : "flask-outline"}
              size={size}
            />
          )
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarLabel: "Products",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              color={color}
              name={focused ? "bag-handle" : "bag-handle-outline"}
              size={size}
            />
          )
        }}
      />
    </Tabs>
  );
}
