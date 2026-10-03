/**
 * Pantry — inventory-first bakery assistant.
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
import { Icon, IconName, PantryLogo } from './src/components/Icon';
import { useLayout } from './src/components/ui';
import { Intent, Nav, NavContext, TabName } from './src/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { StoreProvider } from './src/state/store';
import { colors, fontFamily } from './src/theme';

const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'inventory', label: 'Inventory', icon: 'jar' },
  { name: 'sales', label: 'Sales', icon: 'receipt' },
];

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

function NavItem({
  tab,
  selected,
  wide,
  onPress,
}: {
  tab: (typeof TABS)[number];
  selected: boolean;
  wide: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-current={selected ? 'page' : undefined}
      accessibilityLabel={tab.label}
      onPress={onPress}
      style={[wide ? styles.sideItem : styles.tab, selected && styles.itemSelected]}>
      <Icon
        name={tab.icon}
        size={34}
        color={selected ? colors.white : colors.green}
      />
      <Text
        style={[
          wide ? styles.sideLabel : styles.tabLabel,
          selected && styles.labelSelected,
        ]}>
        {tab.label}
      </Text>
    </Pressable>
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
  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  const items = TABS.map(t => (
    <NavItem
      key={t.name}
      tab={t}
      wide={wide}
      selected={t.name === tab}
      onPress={() => setTab(t.name)}
    />
  ));

  return (
    <NavContext.Provider value={nav}>
      <View style={[styles.container, wide && styles.containerWide]}>
        {wide ? (
          <View
            accessibilityRole="tablist"
            aria-label="Main"
            style={[styles.sidebar, { paddingTop: insets.top + 40 }]}>
            <View style={styles.brand}>
              <PantryLogo size={64} />
              <Text style={styles.wordmark}>Pantry</Text>
            </View>
            <View style={styles.sideItems}>{items}</View>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        ) : null}
        <View style={styles.content}>
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'inventory' ? <InventoryScreen /> : null}
          {tab === 'sales' ? <SalesScreen /> : null}
        </View>
        {wide ? null : (
          <View
            style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
            accessibilityRole="tablist">
            {items}
          </View>
        )}
      </View>
    </NavContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  containerWide: { flexDirection: 'row' },
  content: { flex: 1, minWidth: 0 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 300,
    backgroundColor: colors.cream,
    borderRightWidth: 2,
    borderRightColor: colors.border,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 44,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: 42,
    fontWeight: '600',
    color: colors.text,
  },
  sideItems: { gap: 12 },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 72,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  sideLabel: {
    fontFamily: fontFamily.body,
    fontSize: 26,
    fontWeight: '600',
    color: colors.text,
  },
  itemSelected: { backgroundColor: colors.accent },
  labelSelected: { color: colors.white },
  date: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    fontFamily: fontFamily.body,
    fontSize: 24,
    fontWeight: '500',
    color: colors.muted,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 6,
    gap: 2,
  },
  tabLabel: {
    fontFamily: fontFamily.body,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
});

export default App;
