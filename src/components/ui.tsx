/** Shared building blocks in the Zeno black-and-gold style. */
import React, { useId } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  Mask,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

import { colors, fonts, radius, space, type } from '../theme/tokens';

// Layout ------------------------------------------------------------------------

type ScreenProps = {
  children: React.ReactNode;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pad for the status bar when there is no navigation header above. */
  topInset?: boolean;
};

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  topInset,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        topInset && { paddingTop: insets.top + space.lg },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Diagonal stripes fading in from one side, as on the web cards' header bands. */
export function Stripes({
  height,
  fade = 'left',
  stripe = 5,
  gap = 8,
  opacity = 0.3,
}: {
  height: number;
  fade?: 'left' | 'down';
  stripe?: number;
  gap?: number;
  opacity?: number;
}) {
  const id = useId().replace(/:/g, '');
  const size = stripe + gap;
  const horizontal = fade === 'left';
  return (
    <Svg
      width="100%"
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id={`p${id}`}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect
            width={stripe}
            height={size}
            fill={`rgba(255,255,255,${opacity})`}
          />
        </Pattern>
        <LinearGradient
          id={`g${id}`}
          x1="0"
          y1="0"
          x2={horizontal ? '1' : '0'}
          y2={horizontal ? '0' : '1'}
        >
          <Stop
            offset={horizontal ? '0.35' : '0'}
            stopColor="#fff"
            stopOpacity={horizontal ? 0 : 1}
          />
          <Stop offset="1" stopColor="#fff" stopOpacity={horizontal ? 1 : 0} />
        </LinearGradient>
        <Mask id={`m${id}`}>
          <Rect width="100%" height="100%" fill={`url(#g${id})`} />
        </Mask>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        fill={`url(#p${id})`}
        mask={`url(#m${id})`}
      />
    </Svg>
  );
}

type CardProps = {
  children: React.ReactNode;
  title?: string;
  /** Right side of the title row. */
  action?: React.ReactNode;
  /** Show the striped header band. */
  banded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  title,
  action,
  banded,
  onPress,
  style,
}: CardProps) {
  const body = (
    <>
      {banded && (
        <View style={styles.band}>
          <Stripes height={44} />
        </View>
      )}
      <View style={styles.cardBody}>
        {(title || action) && (
          <View style={styles.cardHeader}>
            {title ? <Title>{title}</Title> : <View />}
            {action}
          </View>
        )}
        {children}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          style,
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{body}</View>;
}

// Text ----------------------------------------------------------------------------

export function Display({ children }: { children: React.ReactNode }) {
  return <Text style={[type.display, { color: colors.text }]}>{children}</Text>;
}

/** Playfair-style italic section heading. */
export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={[type.title, { color: colors.text }]}>{children}</Text>;
}

/** Small uppercase label; gold when `accent`. */
export function Label({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Text style={[type.label, { color: accent ? colors.gold : colors.muted }]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        type.body,
        { color: muted ? colors.muted : colors.textSecondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Monospace text for addresses, hashes and figures. */
export function Mono({
  children,
  size = 13,
  color = colors.text,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[type.mono, { fontSize: size, lineHeight: size * 1.35, color }]}
    >
      {children}
    </Text>
  );
}

// Data display ---------------------------------------------------------------------

/** A labelled figure: "NAV / SHARE  1.0421". */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
}) {
  const hintColor =
    tone === 'up'
      ? colors.green
      : tone === 'down'
        ? colors.danger
        : colors.muted;
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <Text
        style={[type.figure, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? (
        <Text style={[type.small, { color: hintColor }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Two-column grid of Stats. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

/** A key/value line inside a card. */
export function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[type.small, { color: colors.muted }]}>{label}</Text>
      {typeof value === 'string' ? (
        mono ? (
          <Mono>{value}</Mono>
        ) : (
          <Text style={[type.small, { color: colors.text }]}>{value}</Text>
        )
      ) : (
        value
      )}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

type BadgeTone = 'gold' | 'green' | 'neutral' | 'danger';

const BADGE: Record<BadgeTone, { fg: string; bg: string; border: string }> = {
  gold: { fg: colors.gold, bg: colors.goldSoft, border: colors.goldLine },
  green: { fg: colors.green, bg: colors.greenSoft, border: colors.greenLine },
  neutral: { fg: colors.muted, bg: 'transparent', border: colors.lineStrong },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger },
};

/** Pill badge: Active, Open, Permissioned, Coming soon. */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const c = BADGE[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}
    >
      <Text style={[type.label, styles.badgeText, { color: c.fg }]}>
        {label}
      </Text>
    </View>
  );
}

// Controls --------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'gold' | 'green' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'gold',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const fill =
    variant === 'gold'
      ? colors.gold
      : variant === 'green'
        ? colors.primaryGreen
        : 'transparent';
  const fg =
    variant === 'gold'
      ? colors.onGold
      : variant === 'ghost'
        ? colors.gold
        : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill },
        variant === 'outline' && {
          borderWidth: 1,
          borderColor: colors.lineControl,
        },
        pressed && { opacity: 0.8 },
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[type.body, styles.strong, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** One-of-n pill selector. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              style={[
                type.small,
                styles.strong,
                { color: selected ? colors.onGold : colors.muted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Toggleable filter chip. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        style={[
          type.small,
          { color: selected ? colors.gold : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.dim}
        selectionColor={colors.gold}
        {...input}
        style={[styles.input, input.style]}
      />
    </View>
  );
}

// States ---------------------------------------------------------------------------

/** Loading spinner, or an error with a retry, for a whole screen or section. */
export function LoadState({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.state}>
      {error ? (
        <>
          <Body muted style={styles.centered}>
            {error}
          </Body>
          {onRetry ? (
            <Button label="Try again" variant="outline" onPress={onRetry} />
          ) : null}
        </>
      ) : (
        <ActivityIndicator color={colors.gold} />
      )}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.state}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {body ? (
        <Body muted style={styles.centered}>
          {body}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: {
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl * 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardPressed: { borderColor: colors.goldLine },
  band: { height: 44, backgroundColor: colors.surface2 },
  cardBody: { padding: space.lg, gap: space.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stat: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.lg,
    columnGap: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    minHeight: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.lineStrong,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { letterSpacing: 0.4 },
  strong: { fontFamily: fonts.semibold },
  centered: { textAlign: 'center' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.gold },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 48,
  },
});
