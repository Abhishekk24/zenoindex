/** One basket: stats, NAV chart, allocation, fees, holdings, activity, trade (web: /dtfs/[id]). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AllocationBar, NavChart } from '../components/charts';
import { TradePanel } from '../components/TradePanel';
import {
  Badge,
  Card,
  Display,
  Divider,
  Empty,
  Label,
  LoadState,
  Mono,
  Row,
  Screen,
  Stat,
  StatGrid,
  Stripes,
} from '../components/ui';
import * as api from '../lib/api';
import {
  AssetMap,
  assetMap,
  isComingSoon,
  isPermissioned,
  strategyOf,
  symbolOf,
} from '../lib/basket';
import {
  formatBps,
  formatDate,
  formatDecimal,
  formatRaw,
  formatSignedBps,
  humanize,
  shortAddress,
} from '../lib/format';
import { useUser } from '../lib/session';
import type { DtfDetail } from '../lib/types';
import type { RootScreenProps } from '../navigation/types';
import { colors, space, type } from '../theme/tokens';

export function BasketDetailScreen({ route }: RootScreenProps<'Basket'>) {
  const { id, side } = route.params;
  const user = useUser();
  const { data, error, loading, reload } = api.useLoad(async () => {
    const [dtf, assets, eligibility] = await Promise.all([
      api.getDtf(id),
      api.listAssets(),
      api.getEligibility(user.wallets[0]?.address ?? null),
    ]);
    return { dtf, assets: assetMap(assets), eligibility };
  }, id);

  if (!data) return <LoadState error={error} onRetry={reload} />;
  const { dtf, assets, eligibility } = data;
  const permissioned = isPermissioned(dtf, assets);
  const baseSymbol = symbolOf(dtf.baseAssetId, assets);

  const notice =
    user.wallets.length === 0
      ? 'Link a wallet in Profile to sign'
      : permissioned && eligibility.kycStatus !== 'verified'
      ? 'Eligibility check needed to sign'
      : undefined;

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Header dtf={dtf} permissioned={permissioned} />
      <Stats dtf={dtf} baseSymbol={baseSymbol} />

      <Card title="NAV performance">
        <NavChart points={dtf.performance} />
      </Card>

      <Card title="Target allocation">
        <AllocationBar
          slices={dtf.weights.map(w => ({
            key: w.assetId,
            label: symbolOf(w.assetId, assets),
            detail: assets.get(w.assetId)?.name,
            bps: w.weightBps,
          }))}
        />
      </Card>

      <TradePanel
        dtf={dtf}
        baseSymbol={baseSymbol}
        initialSide={side}
        notice={notice}
        disabledReason={
          isComingSoon(dtf)
            ? 'This basket opens for investment once the manager publishes it.'
            : undefined
        }
      />

      <Card title="Fees & terms">
        <Row label="Entry fee" value={formatBps(dtf.fees.entryBps)} />
        <Row label="Exit fee" value={formatBps(dtf.fees.exitBps)} />
        <Row
          label="Management fee"
          value={`${formatBps(dtf.fees.managementBps)} / yr`}
        />
        <Row
          label="Minimum investment"
          value={
            dtf.minInvestment
              ? `${formatDecimal(dtf.minInvestment)} ${baseSymbol}`
              : '—'
          }
        />
        <Row
          label="Rebalance policy"
          value={humanize(strategyOf(dtf))}
          mono={false}
        />
        {dtf.strategy?.driftThresholdBps ? (
          <Row
            label="Drift threshold"
            value={formatBps(dtf.strategy.driftThresholdBps)}
          />
        ) : null}
        <Row label="Base asset" value={baseSymbol} />
        {dtf.contractAddress ? (
          <Row label="Contract" value={shortAddress(dtf.contractAddress)} />
        ) : null}
      </Card>

      <Holdings dtf={dtf} assets={assets} />
      <Activity dtf={dtf} assets={assets} />
    </Screen>
  );
}

function Header({
  dtf,
  permissioned,
}: {
  dtf: DtfDetail;
  permissioned: boolean;
}) {
  return (
    <View style={styles.header}>
      <Stripes height={132} fade="down" stripe={6} gap={16} opacity={0.18} />
      <View style={styles.badges}>
        {isComingSoon(dtf) ? (
          <Badge label="Coming soon" />
        ) : (
          <Badge label="Active" tone="green" />
        )}
        {permissioned ? (
          <Badge label="Permissioned" tone="gold" />
        ) : (
          <Badge label="Open" />
        )}
      </View>
      <Display>{dtf.name}</Display>
      <Mono color={colors.gold} size={15}>
        {dtf.symbol}
      </Mono>
      <View style={styles.manager}>
        <Label>Manager</Label>
        <Mono size={12} color={colors.textSecondary}>
          {shortAddress(dtf.manager)}
        </Mono>
      </View>
    </View>
  );
}

function Stats({ dtf, baseSymbol }: { dtf: DtfDetail; baseSymbol: string }) {
  const inception = dtf.performanceDeltas.find(d => d.window === 'inception');
  const latest = dtf.performanceDeltas.find(d => d.window === 'latest');
  const tone = (bps?: number) =>
    bps === undefined || bps === 0 ? undefined : bps > 0 ? 'up' : 'down';
  return (
    <Card>
      <StatGrid>
        <Stat
          label="NAV / share"
          value={formatDecimal(dtf.sharePrice, 4)}
          hint={
            latest
              ? `${formatSignedBps(latest.sharePriceDeltaBps)} today`
              : undefined
          }
          tone={tone(latest?.sharePriceDeltaBps)}
        />
        <Stat label={`AUM · ${baseSymbol}`} value={formatDecimal(dtf.aum, 0)} />
        <Stat
          label="Since inception"
          value={
            inception ? formatSignedBps(inception.sharePriceDeltaBps) : '—'
          }
          hint={
            inception
              ? `from ${formatDate(inception.fromObservedAt)}`
              : undefined
          }
          tone={tone(inception?.sharePriceDeltaBps)}
        />
        <Stat
          label="Total supply"
          value={formatRaw(dtf.totalSupplyRaw, dtf.shareDecimals, 0)}
          hint={dtf.symbol}
        />
      </StatGrid>
    </Card>
  );
}

function Holdings({ dtf, assets }: { dtf: DtfDetail; assets: AssetMap }) {
  return (
    <Card title="Holdings">
      {dtf.holdings.length === 0 ? (
        <Empty title="No holdings yet" />
      ) : (
        dtf.holdings.map((h, i) => (
          <View key={h.assetId} style={{ gap: space.xs }}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Text style={[type.heading, { color: colors.text }]}>
                {symbolOf(h.assetId, assets)}
              </Text>
              <Mono>
                {formatRaw(
                  h.quantityRaw,
                  assets.get(h.assetId)?.decimals ?? 18,
                  4,
                )}
              </Mono>
            </View>
            <View style={styles.line}>
              <Text style={[type.small, { color: colors.muted }]}>
                Target {formatBps(h.targetWeightBps)}
              </Text>
              <Text style={[type.small, { color: colors.muted }]}>
                Actual {formatBps(h.actualWeightBps)}
              </Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

function Activity({ dtf, assets }: { dtf: DtfDetail; assets: AssetMap }) {
  return (
    <Card title="Recent activity">
      {dtf.recentTransactions.length === 0 ? (
        <Empty title="No activity yet" />
      ) : (
        dtf.recentTransactions.map((tx, i) => (
          <View key={tx.id} style={{ gap: space.xs }}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Badge
                label={humanize(tx.action)}
                tone={tx.action === 'invest' ? 'green' : 'neutral'}
              />
              <Text style={[type.small, { color: colors.muted }]}>
                {formatDate(tx.occurredAt)}
              </Text>
            </View>
            <View style={styles.line}>
              <Mono size={12} color={colors.textSecondary}>
                {tx.walletAddress ? shortAddress(tx.walletAddress) : '—'}
              </Mono>
              <Mono size={12}>
                {tx.amountRaw
                  ? `${formatRaw(
                      tx.amountRaw,
                      dtf.baseAssetDecimals,
                    )} ${symbolOf(tx.assetId, assets)}`
                  : '—'}
              </Mono>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    overflow: 'hidden',
  },
  badges: { flexDirection: 'row', gap: space.sm },
  manager: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
});
