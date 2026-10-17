/**
 * Manager → basket → Fees (design: Fee Schedule + "See accrued and
 * claimable" sheet), from GET /manager/dtfs/:id and GET /manager/fees.
 *
 * Vaults charge an entry fee on deposits and an exit fee on redemptions (no
 * annual management fee). Each fee is escrowed in the FeeEscrow: 80% accrues
 * to the manager — one balance across all their baskets — and 20% to the
 * platform. Claim Fees pays the whole balance to the manager wallet; only the
 * basket's manager can claim (operators accrue nothing).
 */
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomDrawer } from '../../../components/manager/BottomDrawer';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { ManagerTable } from '../../../components/manager/ManagerTable';
import { alert, Button } from '../../../components/ui';
import { useLoad } from '../../../hooks/useLoad';
import { useSendDraft } from '../../../hooks/useSendDraft';
import * as api from '../../../lib/api';
import { formatBps, formatDecimal } from '../../../lib/format';
import { colors, fonts, radius, space } from '../../../theme/tokens';

const FEE_INFO =
  'Entry and exit fees are taken on each deposit and redemption: 80% accrues to the manager across all their baskets, 20% to the platform.';

const ACCRUAL = [
  { label: 'Basis', value: 'Per deposit / redemption' },
  { label: 'Manager share', value: '80%' },
  { label: 'Claim cadence', value: 'Manager-initiated' },
  { label: 'Performance fee', value: 'None' },
];

async function loadFees(id: string) {
  const [dashboard, fees] = await Promise.all([
    api.getManagerDashboard(id),
    api.getManagerFees(),
  ]);
  return { dashboard, fees };
}

export default function ManagerFeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sendDraft = useSendDraft();
  const { data, loading, error, reload } = useLoad(
    async () => (id ? loadFees(id) : undefined),
    `manager-fees#${id ?? ''}`,
  );
  const [claiming, setClaiming] = useState(false);
  const dtf = data?.dashboard.dtf;
  const fees = data?.fees;
  const canClaim = !!fees?.available && fees.claimableRaw !== '0' && !claiming;

  const claim = async () => {
    if (!dtf) return;
    setClaiming(true);
    try {
      await sendDraft(await api.prepareFeeClaim(dtf.chainId));
      alert('Fees claimed', 'Your fees were sent to your wallet.');
      reload();
    } catch (e) {
      alert(
        'Claim failed',
        e instanceof Error ? e.message : 'Could not claim fees.',
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Fee Schedule"
      info={FEE_INFO}
      footer={
        fees ? (
          <BottomDrawer
            tone="green"
            label="See accrued and claimable"
            title="Accrued and claimable"
          >
            <View>
              <Text style={styles.total}>
                {formatDecimal(fees.claimable)} USDG
              </Text>
              <Text style={styles.across}>
                {fees.available
                  ? `Across ${fees.baskets} basket${fees.baskets === 1 ? '' : 's'}`
                  : 'Fee claims start with the next contract deployment.'}
              </Text>
            </View>
            <Button
              label={claiming ? 'Claiming…' : 'Claim Fees'}
              variant="green"
              onPress={claim}
              disabled={!canClaim}
            />
            <Text style={styles.methodLabel}>ACCRUAL METHOD</Text>
            <View style={styles.method}>
              {ACCRUAL.map(row => (
                <View key={row.label} style={styles.methodRow}>
                  <Text style={styles.methodKey}>{row.label}</Text>
                  <Text style={styles.methodValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </BottomDrawer>
        ) : undefined
      }
    >
      {dtf ? (
        <ManagerTable
          columns={[
            { label: 'Entry fee', flex: 1 },
            { label: 'Exit fee', flex: 1 },
            { label: 'AUM', flex: 1.4, align: 'right' },
          ]}
          rows={[
            {
              key: dtf.id,
              cells: [
                formatBps(dtf.fees.entryBps),
                formatBps(dtf.fees.exitBps),
                formatDecimal(dtf.aum),
              ],
            },
          ]}
        />
      ) : null}
    </ManagerBasketScreen>
  );
}

const styles = StyleSheet.create({
  total: { fontFamily: fonts.medium, fontSize: 32, color: colors.text },
  across: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  methodLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.muted,
    marginTop: space.sm,
  },
  method: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  methodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  methodKey: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  methodValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
