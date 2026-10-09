import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, type } from '../../theme/tokens';

/** A tickable line of text (Terms acceptance). */
export function Checkbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: radius.sm / 2,
    borderWidth: 1,
    borderColor: colors.lineControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  tick: { color: colors.onGold, fontFamily: fonts.bold },
  label: { ...type.body, color: colors.textSecondary, flex: 1 },
});
