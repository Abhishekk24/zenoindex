/**
 * Top of Explore: the painted "dreamy money" scene from the website (gold
 * coins growing a sprout on marble under a summer sky) with the serif line.
 * The image's bottom edge already fades into the card colour, so the text
 * sits on plain dark ground and stays readable.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '../../theme/tokens';

export function HeroBanner({ chainName }: { chainName?: string }) {
  return (
    <View style={styles.card}>
      <Image
        source={require('../../../assets/images/hero-banner.jpg')}
        style={styles.art}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {chainName ? (
        <View style={styles.chip}>
          <View style={styles.dot} />
          <Text style={styles.chipText}>Live on {chainName}</Text>
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={styles.title}>
          Wealth that grows,{'\n'}
          <Text style={styles.italic}>one basket</Text> at a time.
        </Text>
        <Text style={styles.body}>
          Deposit USDC, get basket shares at the live NAV, redeem whenever you
          like.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    marginBottom: space.lg,
    borderRadius: radius.lg + 6,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  art: { alignSelf: 'stretch', width: undefined, height: 196, marginBottom: -18 },
  copy: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
  chip: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 7, 6, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
  },
  italic: { fontFamily: fonts.serifItalic, color: colors.gold },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
