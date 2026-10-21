/**
 * A label and its options in one rounded bar (design): Explore's "Sort",
 * Portfolio's "Status" and "View". The chosen option is green. Scrolls
 * sideways if the options don't fit.
 */
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, space } from '../../theme/tokens';

export function OptionBar<T extends string>({
  label,
  options,
  value,
  onChange,
  style,
}: {
  /** "Sort", "Status", "View" … */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Outer spacing, e.g. side margins on a full-width screen. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bar, style]}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${option.label}`}
              style={[styles.option, selected && styles.selected]}
            >
              <Text
                style={[styles.optionText, selected && styles.selectedText]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    paddingLeft: space.md,
    // Fully rounded, bar and options alike (design).
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginRight: space.md,
  },
  options: { gap: 6, flexGrow: 1, justifyContent: 'flex-end' },
  option: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selected: { backgroundColor: colors.greenSoft },
  optionText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  selectedText: { color: colors.green },
});
