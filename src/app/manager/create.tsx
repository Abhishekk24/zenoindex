/**
 * Manager → Create basket (design: Create, step 1 of 7). Opened from the
 * Create tab; full screen with ‹ back.
 *
 * Steps follow the web form: Select Provider, Identity, Constituents, Fees &
 * Access, Review, Deploy, Configure. Only step 1 has a design so far; 2–7 show
 * "Coming soon". Nothing is sent anywhere: there is no create endpoint yet.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoIcon } from '../../components/icons';
import { BottomDrawer } from '../../components/manager/BottomDrawer';
import { BackButton } from '../../components/manager/ManagerBasketScreen';
import { Stripes } from '../../components/ui';
import { colors, fonts, radius, space } from '../../theme/tokens';

const STEPS = [
  'Select Provider',
  'Identity',
  'Constituents',
  'Fees & Access',
  'Review',
  'Deploy',
  'Configure',
];

export default function CreateBasketScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.lg },
        ]}
      >
        <BackButton />
        <Text style={styles.title} accessibilityRole="header">
          Create
        </Text>

        <View style={styles.steps} accessibilityRole="tablist">
          {STEPS.map((name, i) => (
            <Pressable
              key={name}
              onPress={() => setStep(i)}
              accessibilityRole="tab"
              accessibilityLabel={`Step ${i + 1}, ${name}`}
              accessibilityState={{ selected: i === step }}
              hitSlop={4}
              style={[styles.dot, i === step && styles.dotActive]}
            >
              <Text
                style={[styles.dotText, i === step && styles.dotTextActive]}
              >
                {i + 1}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stripes} pointerEvents="none">
            <Stripes height={52} stripe={2} gap={7} opacity={0.16} />
          </View>
          <Text style={styles.stepTitle}>{STEPS[step]}</Text>
        </View>
        {step > 0 ? (
          <Text style={styles.soon}>
            Coming soon. This step isn&apos;t designed yet.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.note}>
          <InfoIcon color={colors.muted} size={18} />
          <Text style={styles.noteText}>
            Nothing touches chain until you confirm and sign the prepared
            transaction.
          </Text>
        </View>
        <View style={styles.nav}>
          <Pressable
            onPress={() => setStep(s => s - 1)}
            disabled={step === 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: step === 0 }}
            style={({ pressed }) => [
              styles.previous,
              step === 0 && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.previousText}>previous</Text>
          </Pressable>
          <Pressable
            onPress={() => setStep(s => s + 1)}
            disabled={last}
            accessibilityRole="button"
            accessibilityState={{ disabled: last }}
            style={({ pressed }) => [
              styles.continue,
              last && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.continueText}>continue</Text>
          </Pressable>
        </View>
        <BottomDrawer label="Preview basket" title="Preview basket">
          <View style={styles.preview}>
            <View style={styles.previewHead}>
              <Text style={styles.previewName}>Basket name</Text>
              <View style={styles.draftBadge}>
                <Text style={styles.draftText}>Draft</Text>
              </View>
            </View>
            <Text style={styles.previewMeta}>SYMBOL · you</Text>
            <Text style={styles.previewEmpty}>
              No constituents yet. They appear here as you add them.
            </Text>
          </View>
        </BottomDrawer>
      </View>
    </View>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.md, paddingBottom: space.xl },
  title: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: space.md,
    paddingHorizontal: space.md,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.lg,
    paddingHorizontal: space.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface3,
  },
  dotActive: { backgroundColor: '#6f7471' },
  dotText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dotTextActive: { color: colors.text },
  stepCard: {
    marginTop: space.lg,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '55%',
    height: 52,
  },
  stepTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  soon: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: space.lg,
    paddingHorizontal: space.sm,
  },
  bottom: { gap: space.lg },
  note: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: 28,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  previous: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  previousText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  continue: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  continueText: { fontFamily: fonts.regular, fontSize: 14, color: '#050706' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  preview: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: space.lg,
    gap: 6,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  previewName: { fontFamily: fonts.medium, fontSize: 17, color: colors.text },
  draftBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  draftText: { fontFamily: fonts.medium, fontSize: 11, color: colors.gold },
  previewMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  previewEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.dim,
    marginTop: space.sm,
  },
});
