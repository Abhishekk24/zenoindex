/** ⓘ next to a section title; tapping shows its explanation (design tooltips). */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';
import { InfoIcon } from '../icons';
import { Popover } from '../ui/Popover';

export function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <Popover
      width={220}
      accessibilityLabel={`About ${label}`}
      trigger={<InfoIcon color={colors.muted} size={17} />}
    >
      {() => <Text style={styles.text}>{text}</Text>}
    </Popover>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
});
