import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '../../theme/tokens';
import { Body } from './Body';

/** Empty state: a title and an optional explanation. */
export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>{title}</Text>
      {body ? (
        <Body muted style={styles.centered}>
          {body}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 48,
  },
  title: { ...type.heading, color: colors.text },
  centered: { textAlign: 'center' },
});
