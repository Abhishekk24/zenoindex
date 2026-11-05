/**
 * The basket page (basket/[id]) while it loads: its header, stats, NAV chart,
 * target allocation and trade card as skeleton shapes, in the page's order.
 * Goes inside LoadState, which makes it pulse.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../../theme/tokens';
import { SkeletonBar, SkeletonCard } from '../ui';

export function BasketPageSkeleton() {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.badges}>
          <SkeletonBar width={64} height={20} round={10} />
          <SkeletonBar width={84} height={20} round={10} />
        </View>
        <SkeletonBar width="65%" height={28} round={8} />
        <SkeletonBar width="45%" />
      </View>
      <SkeletonCard rows={4} />
      <SkeletonCard rows={0}>
        <SkeletonBar height={160} round={8} />
      </SkeletonCard>
      <SkeletonCard rows={3}>
        <SkeletonBar height={10} round={5} />
      </SkeletonCard>
      <SkeletonCard rows={0}>
        <SkeletonBar height={36} round={10} />
        <SkeletonBar height={44} round={10} />
        <SkeletonBar height={48} round={12} />
      </SkeletonCard>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md },
  badges: { flexDirection: 'row', gap: space.sm },
});
