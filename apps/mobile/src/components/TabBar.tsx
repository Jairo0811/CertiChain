import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../theme/colors";

export type Tab = "wallet" | "scan" | "history" | "profile";
type TabIconName = "home" | "scan" | "history" | "profile";

const TABS: Array<{ tab: Tab; icon: TabIconName; label: string }> = [
  { tab: "wallet", icon: "home", label: "Inicio" },
  { tab: "scan", icon: "scan", label: "Escanear" },
  { tab: "history", icon: "history", label: "Historial" },
  { tab: "profile", icon: "profile", label: "Perfil" },
];

function NavIcon({ name, active }: { name: TabIconName; active: boolean }) {
  const stroke = active ? "#C4B5FD" : "#64748B";
  const common = { stroke, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === "home" && <Path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" {...common} />}
      {name === "scan" && (
        <>
          <Path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" {...common} />
          <Rect x="9" y="9" width="6" height="6" rx="1.5" {...common} />
        </>
      )}
      {name === "history" && (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M12 7.5V12l3 2" {...common} />
        </>
      )}
      {name === "profile" && (
        <>
          <Circle cx="12" cy="8" r="3.2" {...common} />
          <Path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6" {...common} />
        </>
      )}
    </Svg>
  );
}

export function TabBar({ current, onSelect }: { current: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map(({ tab, icon, label }) => {
        const active = current === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={styles.item}
            onPress={() => onSelect(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
          >
            <NavIcon name={icon} active={active} />
            <Text style={active ? styles.textActive : styles.text}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 66,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
  },
  item: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 3 },
  text: { color: "#64748B", fontSize: 9, fontWeight: "700" },
  textActive: { color: "#C4B5FD", fontSize: 9, fontWeight: "900" },
});
