/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';

jest.useFakeTimers();

const allText = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map(t => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join('\n');

const pressByLabel = async (root: ReactTestInstance, label: string) => {
  // When several buttons match (e.g. screen and open sheet), use the last one,
  // which is the sheet's.
  const matches = root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAllByType(Text).some(t => {
          const c = t.props.children;
          return (Array.isArray(c) ? c.join('') : String(c)).includes(label);
        })),
  );
  const target = matches[matches.length - 1];
  await ReactTestRenderer.act(async () => {
    target.props.onPress();
  });
};

async function mount() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  return renderer;
}

test('renders every tab and form without crashing', async () => {
  await AsyncStorage.clear();
  const r = await mount();
  const root = r.root;
  expect(allText(root)).toContain("Grandma's Order Desk");
  expect(allText(root)).toContain('Your apples expire in six days');

  await pressByLabel(root, 'Inventory');
  expect(allText(root)).toContain('Apples');
  for (const action of [
    'Add stock',
    'Record batch',
    'Find missing ingredients',
    'Record ingredient waste',
  ]) {
    await pressByLabel(root, action);
    await pressByLabel(root, 'Close');
  }

  await pressByLabel(root, 'Record batch');
  expect(allText(root)).toContain('Missing 500 mL');
  await pressByLabel(root, 'Find missing ingredients');
  expect(allText(root)).toContain('Valley Wholesale Foods');
  await pressByLabel(root, 'Close');

  await pressByLabel(root, 'Sales');
  expect(allText(root)).toContain('Daily aggregate reconciliation');
  await pressByLabel(root, 'Save sale');
  expect(allText(root)).toContain('Sold 1 Apple Crumble Parfait');
  await pressByLabel(root, 'Record unsold treat waste');
  await pressByLabel(root, 'Close');

  await pressByLabel(root, "What's Selling");
  expect(allText(root)).toContain('Ingredient margin');
  await ReactTestRenderer.act(async () => r.unmount());

  // Restart: data comes back from storage, including the new sale.
  const r2 = await mount();
  await pressByLabel(r2.root, 'Sales');
  expect(allText(r2.root)).toContain('$6.50 · 6 ready');
  await ReactTestRenderer.act(async () => r2.unmount());
});
