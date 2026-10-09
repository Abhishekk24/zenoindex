import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, space } from '../../theme/tokens';
import { Body } from './Body';
import { Button } from './Button';

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

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 48,
  },
  centered: { textAlign: 'center' },
});
