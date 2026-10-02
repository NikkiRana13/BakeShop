import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius } from '../theme';

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: 'plain' | 'warm' | 'good' | 'warn' | 'bad';
}) {
  return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
}

const toneStyles = StyleSheet.create({
  plain: {},
  warm: { backgroundColor: colors.accentSoft, borderColor: '#EFC4A2' },
  good: { backgroundColor: colors.greenSoft, borderColor: '#B9D9B3' },
  warn: { backgroundColor: colors.amberSoft, borderColor: '#EED48F' },
  bad: { backgroundColor: colors.redSoft, borderColor: '#EDB8B0' },
});

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
  bold,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  style?: object;
}) {
  return (
    <Text
      style={[
        styles.body,
        muted && styles.muted,
        bold && styles.bold,
        style,
      ]}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' || variant === 'danger'
            ? styles.buttonTextLight
            : null,
          disabled && styles.buttonTextDisabled,
        ]}>
        {icon ? `${icon}  ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.card, borderColor: colors.accent },
  danger: { backgroundColor: colors.red, borderColor: colors.red },
  quiet: { backgroundColor: colors.cardAlt, borderColor: colors.border },
});

export type BadgeTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

/** Status label that always carries text and a symbol, never color alone. */
export function Badge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: BadgeTone;
  icon?: string;
}) {
  const symbol =
    icon ??
    { good: '✓', warn: '!', bad: '✕', info: '•', neutral: '•' }[tone];
  return (
    <View style={[styles.badge, badgeStyles[tone]]}>
      <Text style={[styles.badgeText, badgeText[tone]]}>
        {symbol} {label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  good: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  warn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  bad: { backgroundColor: colors.redSoft, borderColor: colors.red },
  info: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  neutral: { backgroundColor: colors.cardAlt, borderColor: colors.border },
});
const badgeText = StyleSheet.create({
  good: { color: colors.green },
  warn: { color: colors.amber },
  bad: { color: colors.red },
  info: { color: colors.accent },
  neutral: { color: colors.muted },
});

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, strong && styles.bold]}>{value}</Text>
    </View>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.choices}>
        {options.map(o => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.choice, selected && styles.choiceSelected]}>
              <Text
                style={[styles.choiceText, selected && styles.choiceTextSel]}>
                {selected ? '✓ ' : ''}
                {o.label}
              </Text>
              {o.detail ? (
                <Text
                  style={[
                    styles.choiceDetail,
                    selected && styles.choiceTextSel,
                  ]}>
                  {o.detail}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9C8270"
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}
    </View>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(clamp(value - 1))}
          style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          style={styles.stepInput}
          keyboardType="number-pad"
          value={String(value)}
          onChangeText={t => {
            const n = parseInt(t.replace(/\D/g, ''), 10);
            onChange(Number.isFinite(n) ? clamp(n) : min);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(clamp(value + 1))}
          style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
        {suffix ? <Text style={styles.stepSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHeader, Platform.OS === 'android' && { paddingTop: insets.top + 12 }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Notice({
  text,
  tone = 'bad',
}: {
  text: string | null;
  tone?: 'bad' | 'good';
}) {
  if (!text) {
    return null;
  }
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, tone === 'good' ? toneStyles.good : toneStyles.bad]}>
      <Text style={[styles.body, tone === 'good' ? badgeText.good : badgeText.bad]}>
        {tone === 'good' ? '✓ ' : '⚠ '}
        {text}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.body, color: colors.muted, marginTop: -6 },
  section: {
    fontSize: font.heading,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  body: { fontSize: font.body, color: colors.text, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: font.small, lineHeight: 21 },
  bold: { fontWeight: '700' },
  button: {
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#E8DDD0', borderColor: '#D6C7B5' },
  pressed: { opacity: 0.8 },
  buttonText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  buttonTextLight: { color: colors.white },
  buttonTextDisabled: { color: '#7A6656' },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  statLabel: { fontSize: font.small, color: colors.muted, flexShrink: 1 },
  statValue: { fontSize: font.body, color: colors.text, textAlign: 'right' },
  field: { gap: 6 },
  fieldLabel: { fontSize: font.small, fontWeight: '700', color: colors.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  choiceText: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  choiceDetail: { fontSize: 13, color: colors.muted },
  choiceTextSel: { color: colors.white },
  input: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: font.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.red },
  hint: { fontSize: 14, color: colors.muted },
  errorText: { fontSize: 15, color: colors.red, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 26, fontWeight: '700', color: colors.accent },
  stepInput: {
    width: 80,
    height: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  stepSuffix: { fontSize: font.body, color: colors.muted },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  sheetTitle: {
    fontSize: font.heading,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  closeBtn: {
    minHeight: 48,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
  },
  closeText: { fontSize: font.body, fontWeight: '700', color: colors.accent },
  sheetBody: { padding: 16, gap: 14 },
  notice: { borderRadius: radius.sm, borderWidth: 1, padding: 12 },
});
