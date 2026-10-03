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
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, fontFamily, radius } from '../theme';
import { Icon, IconName } from './Icon';

/** Large-screen layout: the app targets computers and iPads. */
export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    wide: width >= 900,
    columns: width >= 1280 ? 3 : width >= 900 ? 2 : 1,
  };
}

/** Lays children out in equal-width columns that wrap. */
export function Grid({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns?: number;
}) {
  const layout = useLayout();
  const cols = layout.wide ? columns ?? layout.columns : 1;
  return (
    <View style={styles.grid}>
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={[styles.gridItem, { width: `${100 / cols}%` }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Side-by-side on large screens, stacked on narrow ones. */
export function Columns({
  children,
  weights,
}: {
  children: React.ReactNode;
  weights?: number[];
}) {
  const { wide } = useLayout();
  return (
    <View style={wide ? styles.columns : styles.stack}>
      {React.Children.toArray(children).map((child, i) => (
        <View
          key={i}
          style={wide ? [styles.column, { flex: weights?.[i] ?? 1 }] : styles.stack}>
          {child}
        </View>
      ))}
    </View>
  );
}

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
  const { wide } = useLayout();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: insets.top + 24 },
        wide && styles.screenContentWide,
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </ScrollView>
  );
}

export type CardTone = 'plain' | 'warm' | 'good' | 'warn' | 'bad';

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: CardTone;
}) {
  return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
}

const toneStyles = StyleSheet.create({
  plain: {},
  warm: { backgroundColor: colors.cream, borderColor: colors.cream },
  good: { borderColor: colors.green },
  warn: { backgroundColor: colors.cream, borderColor: colors.accent },
  bad: { backgroundColor: colors.cream, borderColor: colors.accent },
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
  icon?: IconName;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const filled = variant === 'primary' || variant === 'danger';
  const textColor = disabled
    ? colors.disabledText
    : filled
    ? colors.white
    : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      aria-disabled={!!disabled}
      accessibilityHint={accessibilityHint}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon ? <Icon name={icon} size={30} color={textColor} strokeWidth={2.8} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  danger: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.white, borderColor: colors.accent },
  quiet: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
  },
});

export type BadgeTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const GLYPH_ICONS: Record<string, IconName> = {
  '★': 'star',
  '⏰': 'clock',
  '!': 'alert',
  '○': 'circle',
  '✓': 'check',
  '✕': 'alert',
};

const TONE_ICON: Record<BadgeTone, IconName> = {
  good: 'check',
  warn: 'alert',
  bad: 'alert',
  info: 'star',
  neutral: 'circle',
};

/** Status label: always a word plus an icon, never color alone. */
export function Badge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: BadgeTone;
  icon?: IconName | string;
}) {
  const name: IconName =
    (icon && (GLYPH_ICONS[icon] ?? (icon as IconName))) || TONE_ICON[tone];
  const iconColor =
    tone === 'good' ? colors.green : tone === 'neutral' ? colors.muted : colors.accent;
  return (
    <View style={[styles.badge, badgeStyles[tone]]}>
      <Icon name={name} size={26} color={iconColor} strokeWidth={2.8} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  good: { backgroundColor: colors.white, borderColor: colors.green },
  warn: { backgroundColor: colors.cream, borderColor: colors.accent },
  bad: { backgroundColor: colors.cream, borderColor: colors.accent },
  info: { backgroundColor: colors.white, borderColor: colors.accent },
  neutral: { backgroundColor: colors.white, borderColor: colors.controlBorder },
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
      <Text style={[styles.statLabel, strong && styles.statLabelStrong]}>
        {label}
      </Text>
      <Text style={[styles.statValue, strong && styles.statValueStrong]}>
        {value}
      </Text>
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
  stacked,
}: {
  label?: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Full-width rows, e.g. picking a treat. */
  stacked?: boolean;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View
        accessibilityRole="radiogroup"
        style={stacked ? styles.choicesStacked : styles.choices}>
        {options.map(o => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              aria-checked={selected}
              onPress={() => onChange(o.value)}
              style={[
                styles.choice,
                stacked && styles.choiceStacked,
                selected && styles.choiceSelected,
              ]}>
              <View style={styles.choiceMain}>
                {selected ? (
                  <Icon name="check" size={22} color={colors.white} strokeWidth={3} />
                ) : null}
                <Text
                  style={[
                    styles.choiceText,
                    styles.choiceLabel,
                    selected && styles.choiceTextSel,
                  ]}>
                  {o.label}
                </Text>
              </View>
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
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="alert" size={26} color={colors.accent} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
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

/** Labelled expandable control: chevron plus words like "See the math". */
export function Disclosure({
  open,
  onToggle,
  openLabel,
  closedLabel,
}: {
  open: boolean;
  onToggle: () => void;
  openLabel: string;
  closedLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      aria-expanded={open}
      onPress={onToggle}
      style={styles.disclosure}>
      <Icon
        name={open ? 'chevronUp' : 'chevronDown'}
        size={32}
        color={colors.accent}
        strokeWidth={3}
      />
      <Text style={styles.disclosureText}>{open ? openLabel : closedLabel}</Text>
    </Pressable>
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
  const { wide } = useLayout();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.sheetHeader,
            Platform.OS === 'android' && { paddingTop: insets.top + 12 },
            wide && styles.sheetHeaderWide,
          ]}>
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
          contentContainerStyle={[
            styles.sheetBody,
            { paddingBottom: insets.bottom + 48 },
            wide && styles.sheetBodyWide,
          ]}
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
      aria-live="polite"
      style={[styles.notice, tone === 'good' ? styles.noticeGood : styles.noticeBad]}>
      <Icon
        name={tone === 'good' ? 'check' : 'alert'}
        size={30}
        color={tone === 'good' ? colors.green : colors.accent}
        strokeWidth={2.8}
      />
      <Text style={[styles.body, styles.noticeText]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: 20, paddingBottom: 48, gap: 24 },
  screenContentWide: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 56,
    paddingTop: 48,
    gap: 32,
  },
  header: { gap: 6 },
  title: {
    fontFamily: fontFamily.display,
    fontSize: font.title,
    lineHeight: 64,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    color: colors.muted,
  },
  section: {
    fontFamily: fontFamily.display,
    fontSize: font.heading,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 28,
    gap: 14,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    color: colors.text,
    lineHeight: 36,
  },
  muted: { color: colors.muted, fontSize: font.small, lineHeight: 34 },
  bold: { fontWeight: '600' },
  button: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.disabledBg,
    borderColor: colors.disabledBg,
  },
  pressed: { opacity: 0.85 },
  buttonText: {
    fontFamily: fontFamily.body,
    fontSize: font.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 16,
    paddingVertical: 4,
  },
  statLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.text,
    flexShrink: 1,
  },
  statLabelStrong: { fontSize: font.body, fontWeight: '600' },
  statValue: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  statValueStrong: { fontSize: 30, fontWeight: '700' },
  field: { gap: 10 },
  fieldLabel: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.text,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choicesStacked: { gap: 12 },
  choice: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  choiceStacked: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  choiceMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  choiceText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.text,
    fontWeight: '600',
  },
  choiceDetail: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.muted,
    flexShrink: 0,
  },
  choiceTextSel: { color: colors.white },
  choiceLabel: { flexShrink: 1 },
  input: {
    minHeight: 64,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    fontFamily: fontFamily.body,
    fontSize: font.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.accent },
  hint: { fontFamily: fontFamily.body, fontSize: font.small, color: colors.muted },
  errorRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: font.small,
    color: colors.accent,
    fontWeight: '600',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontFamily: fontFamily.body,
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
  },
  stepInput: {
    width: 96,
    height: 68,
    borderWidth: 2,
    borderColor: colors.controlBorder,
    borderRadius: 18,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
  },
  stepSuffix: { fontFamily: fontFamily.body, fontSize: font.small, color: colors.muted },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
  },
  disclosureText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.accent,
  },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
  },
  sheetHeaderWide: { paddingHorizontal: 40, paddingVertical: 24 },
  sheetTitle: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  closeBtn: {
    minHeight: 60,
    minWidth: 110,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.white,
  },
  closeText: {
    fontFamily: fontFamily.body,
    fontSize: font.small,
    fontWeight: '600',
    color: colors.accent,
  },
  sheetBody: { padding: 20, gap: 20 },
  sheetBodyWide: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    padding: 40,
  },
  notice: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    padding: 18,
  },
  noticeGood: { backgroundColor: colors.white, borderColor: colors.green },
  noticeBad: { backgroundColor: colors.cream, borderColor: colors.accent },
  noticeText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -10 },
  gridItem: { padding: 10 },
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  column: { minWidth: 0, gap: 20 },
  stack: { gap: 20 },
});
