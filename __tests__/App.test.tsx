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

  // First Nations relief: opening and confirming never saves a sale.
  await pressByLabel(root, 'First Nations tax relief');
  for (const text of [
    "eligible for Ontario's First Nations point-of-sale",
    'inspected an accepted status document',
    'This purchase qualifies',
  ]) {
    await pressByLabel(root, text);
  }
  await pressByLabel(root, 'Apply relief to this sale');
  expect(allText(root)).toContain('$6.50 + tax · 6 ready');
  expect(allText(root)).toContain('First Nations rebate (Ontario)');
  await pressByLabel(root, 'Save sale');
  expect(allText(root)).toContain('$6.83 including tax');
  // Eligibility resets after the sale.
  expect(allText(root)).toContain('First Nations tax relief');
  expect(allText(root)).not.toContain('Remove relief');

  await pressByLabel(root, 'Tax summary');
  expect(allText(root)).toContain('Net tax collected from customers');

  await pressByLabel(root, "What's Selling");
  expect(allText(root)).toContain('Ingredient margin');
  await ReactTestRenderer.act(async () => r.unmount());

  // Restart: data comes back from storage, including the new sale.
  const r2 = await mount();
  await pressByLabel(r2.root, 'Sales');
  expect(allText(r2.root)).toContain('$6.50 + tax · 5 ready');
  await ReactTestRenderer.act(async () => r2.unmount());
});

const pressFirstByText = async (root: ReactTestInstance, label: string) => {
  const target = root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some(t => {
        const c = t.props.children;
        return (Array.isArray(c) ? c.join('') : String(c)).includes(label);
      }),
  )[0];
  await ReactTestRenderer.act(async () => {
    target.props.onPress();
  });
};

test('vendor search: cost tip → picks → email draft → reply → quote', async () => {
  await AsyncStorage.clear();
  const r = await mount();
  const root = r.root;

  // #1: What's Selling points at the biggest cost and links to vendor search.
  await pressByLabel(root, "What's Selling");
  expect(allText(root)).toContain('Yogurt is 33% of your ingredient spend');
  await pressByLabel(root, 'See other options');

  // The Vendors tab opens and searches for yogurt (sample data offline).
  const text = allText(root);
  expect(text).toContain('Types on the market');
  expect(text).toContain('Greek yogurt');
  expect(text).toContain('Sample results (no live search)');
  expect(text).toContain('🌿 Local & natural');
  expect(text).toContain('💰 Best for bulk');
  expect(text).toContain('📍 Closest');
  expect(text).toContain('Hillside Dairy & Market');
  expect(text).toContain("Big chains don't answer price emails");

  // Pick the local store and draft an email with real numbers (#3, #6).
  await pressFirstByText(root, 'Select to email');
  await pressByLabel(root, 'Draft emails (1)');
  const draft = root.findAll(
    n => n.props.accessibilityLabel === 'Message' && typeof n.props.value === 'string',
  )[0];
  expect(draft.props.value).toContain('I use about 21 kg of yogurt a week');
  expect(draft.props.value).toContain('does the price change by season?');
  await pressByLabel(root, 'Open in Mail');
  await pressByLabel(root, 'Done');
  expect(allText(root)).toContain('waiting for a reply');
  expect(allText(root)).toContain('Your vendors');

  // Paste the reply; it is read offline and shown as cost per treat (#2).
  await pressByLabel(root, 'Add their reply');
  await pressByLabel(root, 'Use the sample reply');
  await pressByLabel(root, 'Read the price');
  const reply = allText(root);
  expect(reply).toContain('Hillside Dairy & Market quoted $19.00 for 5 kg');
  expect(reply).toContain('Apple Crumble Parfait: $1.69 → $1.64 per treat');
  expect(reply).toContain('Saves about $43/month at your usual volume');
  await pressByLabel(root, 'Save quote');

  const card = allText(root);
  expect(card).toContain("Saved Hillside Dairy & Market's quote");
  expect(card).toContain('Yogurt: $19.00 for 5 kg');
  expect(card).toContain('🍂 Seasonal');
  await ReactTestRenderer.act(async () => r.unmount());
});
