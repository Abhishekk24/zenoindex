import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '../../theme/tokens';

/** A bordered card with a plain title (Security). */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
});
