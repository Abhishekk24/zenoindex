/**
 * Manager → basket → Fees (design: Fee Schedule + "See accrued and
 * claimable" sheet), from GET /manager/dtfs/:id.
 *
 * The deployed vaults charge an entry fee on deposits and an exit fee on
 * redemptions (no annual management fee), split 80% manager / 20% platform
 * and paid straight to the fee recipient, so nothing accrues to claim.
 * shortcut: claimable fees + Claim Fees need FeeEscrow (zenoindex-evm d3bd438), not deployed yet; wire them when it is.
 */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomDrawer } from '../../../components/manager/BottomDrawer';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { ManagerTable } from '../../../components/manager/ManagerTable';
import { useLoad } from '../../../hooks/useLoad';
import * as api from '../../../lib/api';
import { formatBps, formatDecimal, shortAddress } from '../../../lib/format';
import { colors, fonts, radius, space } from '../../../theme/tokens';

const FEE_INFO =
  'Entry and exit fees are taken on each deposit and redemption: 80% to the manager, 20% to the platform, paid out straight away.';

export default function ManagerFeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useLoad(
    async () => (id ? api.getManagerDashboard(id) : undefined),
    `manager-fees#${id ?? ''}`,
  );
  const dtf = data?.dtf;

  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Fee Schedule"
      info={FEE_INFO}
      footer={
        data ? (
          <BottomDrawer
            tone="green"
            label="See where fees go"
            title="Fee payouts"
          >
            <View>
              <Text style={styles.total}>
                {shortAddress(data.feeRecipient)}
              </Text>
              <Text style={styles.across}>
                Fee recipient · paid on every deposit and redemption
              </Text>
            </View>
            <Text style={styles.methodLabel}>ACCRUAL METHOD</Text>
            <View style={styles.method}>
              {[
                { label: 'Basis', value: 'Per deposit / redemption' },
                { label: 'Manager share', value: '80%' },
                { label: 'Claim cadence', value: 'Paid instantly' },
                { label: 'Performance fee', value: 'None' },
              ].map(row => (
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
