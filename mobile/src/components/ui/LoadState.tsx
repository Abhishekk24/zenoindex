import React from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../../theme/tokens';
import { Body } from './Body';
import { Button } from './Button';
import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * A screen or section that hasn't loaded: a skeleton in its place (the
 * screen's own `placeholder`, or two skeleton cards), or the error with a
 * retry. Never a spinner.
 */
export function LoadState({
  error,
  onRetry,
  placeholder,
}: {
  error?: string;
  onRetry?: () => void;
  /** The screen's shape while loading; two skeleton cards by default. */
  placeholder?: React.ReactNode;
}) {
  if (!error) {
    return (
      <Skeleton style={styles.skeleton}>
        {placeholder ?? (
          <>
            <SkeletonCard />
            <SkeletonCard rows={2} />
          </>
        )}
      </Skeleton>
    );
  }
  return (
    <View style={styles.error}>
      <Body muted style={styles.centered}>
        {error}
      </Body>
      {onRetry ? (
        <Button label="Try again" variant="outline" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  error: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: 48,
  },
  centered: { textAlign: 'center' },
});
