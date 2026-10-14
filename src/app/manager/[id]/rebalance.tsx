/**
 * Manager → basket → Rebalance (design: Transaction Draft + Sign and submit).
 * SAMPLE DATA: the API has no rebalance-prepare endpoint yet, and there is no
 * design for the target-weights editor that comes before the draft on the web.
 */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopyIcon, PenIcon } from '../../../components/icons';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { shortAddress } from '../../../lib/format';
import { sampleBasket, sampleRebalanceDraft } from '../../../manager/sample';
import { colors, fonts, space } from '../../../theme/tokens';

/** 0X8C1A5F2E0…0000000001, as the design shows calldata. */
function shortCalldata(data: string): string {
  if (data.length <= 24) return data.toUpperCase();
  return `${data.slice(0, 11)}…${data.slice(-10)}`.toUpperCase();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ManagerRebalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const dtf = sampleBasket(id);
  const draft = sampleRebalanceDraft;

  return (
    <ManagerBasketScreen
      dtf={dtf}
      title="Rebalance"
      footer={
        <Pressable
          onPress={() =>
            Alert.alert(
              'Not connected yet',
              'Signing a rebalance needs the rebalance-prepare endpoint on the ZenoIndex API.',
            )
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submit,
            { paddingBottom: insets.bottom + space.lg },
            pressed && styles.pressed,
          ]}
        >
          <PenIcon color={colors.text} size={18} />
          <Text style={styles.submitText}>Sign and submit</Text>
        </Pressable>
      }
    >
      <View style={styles.draftHead}>
        <Text style={styles.draftTitle}>Transaction Draft</Text>
      </View>
      <View style={styles.row}>
        <Field label="To" value={shortAddress(draft.to)} />
        <Field label="Chain ID" value={String(draft.chainId)} />
      </View>
      <View style={styles.row}>
        <Field label="Value" value={draft.value} />
        <Field label="Request ID" value={draft.requestId} />
      </View>
      <View style={styles.row}>
        <Field label="Calldata" value={shortCalldata(draft.calldata)} />
        <Pressable
          // shortcut: opens the share sheet (which has Copy); a one-tap copy needs the expo-clipboard package.
          onPress={() => void Share.share({ message: draft.calldata })}
          accessibilityRole="button"
          accessibilityLabel="Copy calldata"
          hitSlop={12}
          style={styles.copy}
        >
          <CopyIcon color={colors.text} size={20} />
        </Pressable>
      </View>
    </ManagerBasketScreen>
  );
}

const styles = StyleSheet.create({
  draftHead: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  draftTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  field: { flex: 1, gap: 8 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  value: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  copy: { padding: space.xs },
  submit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingTop: 20,
    backgroundColor: colors.primaryGreen,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pressed: { opacity: 0.85 },
  submitText: { fontFamily: fonts.medium, fontSize: 17, color: colors.text },
});
