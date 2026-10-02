/**
 * Grandma's Order Desk — inventory-first bakery assistant.
 *
 * @format
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Intent, Nav, NavContext, TabName } from './src/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { useLayout } from './src/components/ui';
import { StoreProvider } from './src/state/store';
import { colors } from './src/theme';

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'home', label: 'Home', icon: '🏠' },
  { name: 'inventory', label: 'Inventory', icon: '🧺' },
  { name: 'sales', label: 'Sales', icon: '💵' },
  { name: 'insights', label: "What's Selling", icon: '📈' },
];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <StoreProvider
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        }>
        <AppContent />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const [tab, setTab] = useState<TabName>('home');
  const [intent, setIntent] = useState<Nav['intent']>(null);
  const intentId = useRef(0);

  const go = useCallback((next: TabName, nextIntent?: Intent) => {
    setTab(next);
    if (nextIntent) {
      intentId.current += 1;
      setIntent({ ...nextIntent, id: intentId.current });
    }
  }, []);
  const clearIntent = useCallback(() => setIntent(null), []);
  const nav = useMemo(
    () => ({ tab, intent, go, clearIntent }),
    [tab, intent, go, clearIntent],
  );

  const tabButtons = TABS.map(t => {
    const selected = t.name === tab;
    return (
      <Pressable
        key={t.name}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={t.label}
        onPress={() => setTab(t.name)}
        style={[
          styles.tab,
          wide ? styles.tabWide : styles.tabNarrow,
          selected && styles.tabSelected,
        ]}>
        <Text style={styles.tabIcon}>{t.icon}</Text>
        <Text
          style={[
            styles.tabLabel,
            wide && styles.tabLabelWide,
            selected && styles.tabLabelSelected,
          ]}
          // One-line fitting is for the narrow bottom bar; on web it
          // collapses the label's width inside the wide top bar.
          numberOfLines={wide ? undefined : 1}
          adjustsFontSizeToFit={!wide}>
          {t.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <NavContext.Provider value={nav}>
      <View style={styles.container}>
        {wide ? (
          // Computers and iPads: top bar with the app name and large tabs.
          <View
            style={[styles.topBar, { paddingTop: insets.top + 10 }]}
            accessibilityRole="tablist">
            <View style={styles.topBarInner}>
              <Text style={styles.brand}>🧁 Grandma's Order Desk</Text>
              <View style={styles.topTabs}>{tabButtons}</View>
            </View>
          </View>
        ) : null}
        <View style={styles.content}>
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'inventory' ? <InventoryScreen /> : null}
          {tab === 'sales' ? <SalesScreen /> : null}
          {tab === 'insights' ? <InsightsScreen /> : null}
        </View>
        {wide ? null : (
          <View
            style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
            accessibilityRole="tablist">
            {tabButtons}
          </View>
        )}
      </View>
    </NavContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  tab: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
  },
  tabNarrow: { flex: 1 },
  tabWide: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 22,
  },
  tabSelected: { backgroundColor: colors.accentSoft },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tabLabelWide: { fontSize: 19 },
  topBar: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  topBarInner: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: { fontSize: 22, fontWeight: '800', color: colors.text },
  topTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabLabelSelected: { color: colors.accent, fontWeight: '800' },
});

export default App;
