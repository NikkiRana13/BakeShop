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

  return (
    <NavContext.Provider value={nav}>
      <View style={styles.container}>
        <View style={styles.content}>
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'inventory' ? <InventoryScreen /> : null}
          {tab === 'sales' ? <SalesScreen /> : null}
          {tab === 'insights' ? <InsightsScreen /> : null}
        </View>
        <View
          style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
          accessibilityRole="tablist">
          {TABS.map(t => {
            const selected = t.name === tab;
            return (
              <Pressable
                key={t.name}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={t.label}
                onPress={() => setTab(t.name)}
                style={[styles.tab, selected && styles.tabSelected]}>
                <Text style={styles.tabIcon}>{t.icon}</Text>
                <Text
                  style={[styles.tabLabel, selected && styles.tabLabelSelected]}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
  },
  tabSelected: { backgroundColor: colors.accentSoft },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tabLabelSelected: { color: colors.accent, fontWeight: '800' },
});

export default App;
