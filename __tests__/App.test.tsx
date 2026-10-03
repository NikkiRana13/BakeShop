/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import App from '../App';

jest.useFakeTimers();

/** Flattens a Text node, including nested Text, into a plain string. */
const textOf = (node: ReactTestInstance | string): string => {
  if (typeof node === 'string') {
    return node;
  }
  return node.children.map(textOf).join('');
};

const allText = (root: ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map(t => textOf(t))
    .join('\n');

/**
 * Presses a control by exact accessibility label, else by visible text.
 * When several match (screen and open sheet), the last one (the sheet's) wins.
 */
const pressByLabel = async (root: ReactTestInstance, label: string) => {
  const pressable = root.findAll(n => typeof n.props.onPress === 'function');
  const exact = pressable.filter(n => n.props.accessibilityLabel === label);
  const matches = exact.length
    ? exact
    : pressable.filter(n =>
        n.findAllByType(Text).some(t => textOf(t).includes(label)),
      );
  if (matches.length === 0) {
    throw new Error(`No control labelled "${label}"`);
  }
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

test('renders every page and form without crashing', async () => {
  await AsyncStorage.clear();
  const r = await mount();
  const root = r.root;
  expect(allText(root)).toContain('Hello, Grandma');
  expect(allText(root)).toContain(
    'Apples expire in 6 days. Use them in an Apple Crumble batch.',
  );
  expect(allText(root)).toContain('Cream is low.');

  await pressByLabel(root, 'Inventory');
  expect(allText(root)).toContain('Shopping help');
  expect(allText(root)).toContain('Cream: you need 500 mL more');
  expect(allText(root)).toContain('Valley Wholesale Foods');
  for (const action of [
    'Add stock',
    'Record a batch',
    'Find missing ingredients',
    'Record ingredient waste',
  ]) {
    await pressByLabel(root, action);
    await pressByLabel(root, 'Close');
  }
  await pressByLabel(root, 'Record a batch');
  expect(allText(root)).toContain('Missing 500 mL');
  await pressByLabel(root, 'Close');

  await pressByLabel(root, 'Sales');
  expect(allText(root)).toContain('Today’s closing');
  expect(allText(root)).toContain('How each treat is doing');
  await pressByLabel(root, 'Save sale');
  expect(allText(root)).toContain('Sold 1 Apple Crumble Parfait');
  await pressByLabel(root, 'Record unsold treat waste');
  await pressByLabel(root, 'Close');

  // First Nations relief: confirming never saves a sale.
  await pressByLabel(root, 'First Nations tax relief');
  for (const text of [
    "eligible for Ontario's First Nations point-of-sale",
    'inspected an accepted status document',
    'This purchase qualifies',
  ]) {
    await pressByLabel(root, text);
  }
  await pressByLabel(root, 'Apply relief to this sale');
  expect(allText(root)).toContain('$6.50 · 6 ready');
  expect(allText(root)).toContain('First Nations rebate');
  await pressByLabel(root, 'Save sale');
  expect(allText(root)).toContain('$6.83 including tax');
  expect(allText(root)).not.toContain('Remove relief');

  await pressByLabel(root, 'Tax summary');
  expect(allText(root)).toContain('Net tax collected from customers');

  await pressByLabel(root, 'Close the day');
  expect(allText(root)).toContain('Daily aggregate reconciliation');
  await pressByLabel(root, 'Close');

  await pressByLabel(
    root,
    'See why: Pumpkin Parfait, Make 2 fewer batches over the next six days',
  );
  expect(allText(root)).toContain('How we worked this out');
  await ReactTestRenderer.act(async () => r.unmount());

  // Restart: data comes back from storage, including both new sales.
  const r2 = await mount();
  await pressByLabel(r2.root, 'Sales');
  expect(allText(r2.root)).toContain('$6.50 · 5 ready');
  await ReactTestRenderer.act(async () => r2.unmount());
});
