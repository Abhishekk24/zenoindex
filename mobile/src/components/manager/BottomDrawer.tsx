/**
 * A bar pinned to the bottom that opens a sheet (designs: Fees "See accrued
 * and claimable", Create "Preview basket"). The sheet slides up over the
 * screen; its ⌄ or a tap above it closes it.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, space } from '../../theme/tokens';
import { ChevronUpIcon } from '../icons';

export function BottomDrawer({
  label,
  title,
  tone = 'dark',
  children,
}: {
  /** The closed bar's text. */
  label: string;
  /** The open sheet's heading. */
  title: string;
  tone?: 'green' | 'dark';
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const bottom = insets.bottom + space.lg;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.bar,
          tone === 'green' ? styles.green : styles.dark,
          { paddingBottom: bottom },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.barLabel}>{label}</Text>
        <ChevronUpIcon color={colors.text} size={20} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: bottom }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title.toUpperCase()}</Text>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={12}
              style={styles.flip}
            >
              <ChevronUpIcon color={colors.text} size={20} />
            </Pressable>
          </View>
          {children}
          <View style={styles.handle} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  green: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.greenLine,
  },
  dark: { backgroundColor: colors.surface2, borderColor: colors.lineStrong },
  pressed: { opacity: 0.85 },
  barLabel: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.muted,
  },
  flip: { transform: [{ rotate: '180deg' }] },
  handle: {
    alignSelf: 'center',
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineControl,
  },
});
