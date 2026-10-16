/**
 * Manager → basket → Rebalance (design: Transaction Draft + Sign and submit),
 * on GET /manager/dtfs/:id and its …/prepare endpoints.
 *
 * Lists what the basket needs (the dashboard's to-do list): seed it (genesis),
 * invest deposits waiting in a slot, or trade a slot that drifted past its
 * target. Tapping one prepares its transaction, shown as the draft; Sign and
 * submit sends it with the manager's wallet and confirms it with the API.
 * Below the list, Target weights re-weights the basket the same way
 * (POST …/allocations/prepare).
 */
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopyIcon, PenIcon } from '../../../components/icons';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { TargetWeights } from '../../../components/manager/TargetWeights';
import { Empty } from '../../../components/ui';
import { useLoad } from '../../../hooks/useLoad';
import { useSendDraft } from '../../../hooks/useSendDraft';
import * as api from '../../../lib/api';
import { formatBps, formatDecimal, shortAddress } from '../../../lib/format';
import type { TxDraft } from '../../../lib/types';
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

function actionKey(a: api.ManagerAction): string {
  return a.kind === 'genesis' ? 'genesis' : `${a.kind}#${a.slotIndex}`;
}

function actionLabel(a: api.ManagerAction, slots: api.ManagerSlot[]): string {
  if (a.kind === 'genesis') return 'Seed the basket (genesis, 1 USDG)';
  const asset =
    slots.find(s => s.index === a.slotIndex)?.symbol ?? `slot ${a.slotIndex}`;
  if (a.kind === 'deploy') {
    return `Invest ${formatDecimal(a.amountUsdc)} USDG into ${asset}`;
  }
  const sign = a.driftBps > 0 ? '+' : '';
  return `Rebalance ${asset} (${sign}${formatBps(a.driftBps)} vs target)`;
}

/** Why value-moving transactions would revert right now, if they would. */
function blocked(d: api.ManagerDashboard): string | null {
  if (d.status.emergency) return 'The protocol is in emergency mode.';
  if (d.status.adminLocked) return 'This basket is locked by the admin.';
  if (d.status.paused) return 'This basket is paused.';
  return null;
}

export default function ManagerRebalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const sendDraft = useSendDraft();
  const { data, loading, error, reload } = useLoad(
    async () => (id ? api.getManagerDashboard(id) : undefined),
    `manager-rebalance#${id ?? ''}`,
  );
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<TxDraft>();
  const [baseline, setBaseline] = useState('1');
  const [busy, setBusy] = useState<'prepare' | 'send'>();
  const [actionError, setActionError] = useState<string>();

  const dtf = data?.dtf;
  const stop = data ? blocked(data) : null;

  const prepareWith = async (key: string, req: api.ManagerPrepare) => {
    if (!dtf) return;
    setSelected(key);
    setDraft(undefined);
    setActionError(undefined);
    setBusy('prepare');
    try {
      setDraft(await api.prepareManagerTx(dtf, req));
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Could not prepare the transaction.',
      );
    } finally {
      setBusy(undefined);
    }
  };

  const prepare = (action: api.ManagerAction) =>
    prepareWith(
      actionKey(action),
      action.kind === 'genesis'
        ? { name: 'genesis', body: { baselineSharePrice: baseline } }
        : { name: action.kind, body: { slotIndex: action.slotIndex } },
    );

  const submit = async () => {
    if (!draft) return;
    setBusy('send');
    setActionError(undefined);
    try {
      await sendDraft(draft);
      setDraft(undefined);
      setSelected(undefined);
      Alert.alert('Done', 'The transaction is confirmed on-chain.');
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Transaction failed.');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Rebalance"
      footer={
        draft ? (
          <Pressable
            onPress={submit}
            disabled={busy !== undefined}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submit,
              { paddingBottom: insets.bottom + space.lg },
              (pressed || busy === 'send') && styles.pressed,
            ]}
          >
            {busy === 'send' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <PenIcon color={colors.text} size={18} />
            )}
            <Text style={styles.submitText}>
              {busy === 'send'
                ? 'Waiting for confirmation…'
                : 'Sign and submit'}
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      {data ? (
        <View style={styles.actions}>
          {stop ? <Text style={styles.warn}>{stop}</Text> : null}
          {data.actions.length === 0 ? (
            <Empty
              title="Nothing to rebalance"
              body="Every asset is within 0.5% of its target and no deposits are waiting to be invested."
            />
          ) : (
            data.actions.map(action => {
              const key = actionKey(action);
              const active = key === selected;
              return (
                <View key={key} style={styles.actionBox}>
                  <Pressable
                    onPress={() => prepare(action)}
                    disabled={busy !== undefined || stop !== null}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.action, active && styles.actionActive]}
                  >
                    <Text style={styles.actionText}>
                      {actionLabel(action, data.slots)}
                    </Text>
                    {active && busy === 'prepare' ? (
                      <ActivityIndicator color={colors.gold} />
                    ) : null}
                  </Pressable>
                  {action.kind === 'genesis' ? (
                    <View style={styles.baselineRow}>
                      <Text style={styles.label}>
                        STARTING PRICE (USDG / SHARE)
                      </Text>
                      <TextInput
                        value={baseline}
                        onChangeText={t =>
                          setBaseline(
                            t.replace(',', '.').replace(/[^\d.]/g, ''),
                          )
                        }
                        keyboardType="decimal-pad"
                        style={styles.baselineInput}
                        selectionColor={colors.green}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </View>
      ) : null}

      {data && data.slots.length > 0 ? (
        <TargetWeights
          // Reset the sliders when the chain's targets change (after a submit).
          key={data.slots.map(s => s.targetBps).join(',')}
          slots={data.slots}
          disabled={busy !== undefined || stop !== null}
          onPrepare={weights =>
            void prepareWith('weights', {
              name: 'allocations',
              body: { weights },
            })
          }
        />
      ) : null}

      {draft ? (
        <>
          <View style={styles.draftHead}>
            <Text style={styles.draftTitle}>Transaction Draft</Text>
          </View>
          <View style={styles.row}>
            <Field label="To" value={shortAddress(draft.transaction.to)} />
            <Field label="Chain ID" value={String(draft.transaction.chainId)} />
          </View>
          <View style={styles.row}>
            <Field label="Value" value={draft.transaction.value} />
            <Field label="Request ID" value={draft.requestId} />
          </View>
          <View style={styles.row}>
            <Field
              label="Calldata"
              value={shortCalldata(draft.transaction.data)}
            />
            <Pressable
              // shortcut: opens the share sheet (which has Copy); a one-tap copy needs the expo-clipboard package.
              onPress={() =>
                void Share.share({ message: draft.transaction.data })
              }
              accessibilityRole="button"
              accessibilityLabel="Copy calldata"
              hitSlop={12}
              style={styles.copy}
            >
              <CopyIcon color={colors.text} size={20} />
            </Pressable>
          </View>
        </>
      ) : null}
    </ManagerBasketScreen>
  );
}

const ACTION_STYLES = {
  actions: {
    paddingHorizontal: space.md,
    gap: space.sm,
    marginBottom: space.lg,
  },
  actionBox: { gap: space.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
  },
  actionActive: { borderColor: colors.gold },
  actionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  baselineRow: { gap: 8, paddingHorizontal: space.xs },
  baselineInput: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: space.md,
    height: 44,
  },
  warn: { fontFamily: fonts.regular, fontSize: 14, color: colors.gold },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
} as const;

const styles = StyleSheet.create({
  ...ACTION_STYLES,
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
