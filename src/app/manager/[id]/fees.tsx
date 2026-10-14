/**
 * Manager → basket → Fees (design: Fee Schedule + "See accrued and
 * claimable" sheet). SAMPLE DATA: no fee or claim endpoints yet.
 *
 * The table shows the rows the design shows (several, unnamed) although the
 * screen is about one basket; flagged for the designer.
 */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BottomDrawer } from '../../../components/manager/BottomDrawer';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { ManagerTable } from '../../../components/manager/ManagerTable';
import { Button } from '../../../components/ui';
import { formatBps, formatDecimal } from '../../../lib/format';
import {
  sampleAccrual,
  sampleBasket,
  sampleClaimable,
  sampleFeeRows,
} from '../../../manager/sample';
import { colors, fonts, radius, space } from '../../../theme/tokens';

const FEE_INFO =
  'Management fee accrues daily against AUM and is claimable by the manager. Changing a live basket’s fee requires a corporate action.';

/** Estimated yearly management fee: AUM × fee, assuming no flows. */
function estAnnual(aum: string, managementBps: number): string {
  const value = (Number(aum) * managementBps) / 10_000;
  if (!Number.isFinite(value) || value === 0) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ManagerFeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dtf = sampleBasket(id);

  return (
    <ManagerBasketScreen
      dtf={dtf}
      title="Fee Schedule"
      info={FEE_INFO}
      footer={
        <BottomDrawer
          tone="green"
          label="See accrued and claimable"
          title="Accrued and claimable"
        >
          <View>
            <Text style={styles.total}>
              {formatDecimal(sampleClaimable.total)}
            </Text>
            <Text style={styles.across}>
              Across {sampleClaimable.baskets} baskets
            </Text>
          </View>
          <Button
            label="Claim Fees"
            variant="green"
            onPress={() =>
              Alert.alert(
                'Not connected yet',
                'Claiming fees needs the fee-claim endpoint on the ZenoIndex API.',
              )
            }
          />
          <Text style={styles.methodLabel}>ACCRUAL METHOD</Text>
          <View style={styles.method}>
            {sampleAccrual.map(row => (
              <View key={row.label} style={styles.methodRow}>
                <Text style={styles.methodKey}>{row.label}</Text>
                <Text style={styles.methodValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </BottomDrawer>
      }
    >
      <ManagerTable
        columns={[
          { label: 'Fee p.a.', flex: 1 },
          { label: 'AUM', flex: 1.6 },
          { label: 'Est. annual', flex: 1.2, align: 'right' },
        ]}
        rows={sampleFeeRows.map(row => ({
          key: row.id,
          cells: [
            formatBps(row.managementBps),
            Number(row.aum).toFixed(6),
            estAnnual(row.aum, row.managementBps),
          ],
        }))}
      />
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
