/** The linked wallet's positions: value, P&L, allocation, holdings, activity (web: /portfolio). */
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AllocationBar } from '../../components/charts';
import {
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  LoadState,
  Mono,
  Screen,
  Stat,
  StatGrid,
} from '../../components/ui';
import * as api from '../../lib/api';
import { erc20BalanceOf } from '../../lib/chain';
import { compare, fromRaw, mul, ratioBps, sub, sum } from '../../lib/decimal';
import {
  formatDate,
  formatDecimal,
  formatRaw,
  formatSigned,
  formatSignedBps,
  humanize,
} from '../../lib/format';
import { useUser } from '../../lib/session';
import type { Dtf } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';

export default function PortfolioScreen() {
  const user = useUser();
  const wallet =
    user.wallets.find(w => w.primary)?.address ??
    user.walletAddress ??
    user.wallets[0]?.address;

  const { data, error, loading, reload } = api.useLoad(async () => {
    if (!wallet) return null;
    // BUG-1 fallback: while the API portfolio read model is a stub, derive
    // positions from on-chain share balances for every listed DTF.
    const positionsFromChain = async (dtfs: Dtf[]) => {
      const positions = await Promise.all(
        dtfs.map(async dtf => {
          if (!dtf.contractAddress) return null;
          try {
            const shares = await erc20BalanceOf(
              dtf.chainId,
              dtf.contractAddress,
              wallet,
            );
            if (shares === 0n) return null;
            const sharesText = shares.toString();
            return {
              dtfId: dtf.id,
              shares: sharesText,
              value: mul(
                fromRaw(sharesText, dtf.shareDecimals),
                dtf.sharePrice,
              ),
              asOf: new Date().toISOString(),
            };
          } catch {
            return null;
          }
        }),
      );
      return positions.filter(p => p !== null);
    };
    const [view, dtfs] = await Promise.all([
      api.getPortfolio(wallet, positionsFromChain),
      api.listDtfs(),
    ]);
    return { ...view, dtfs: new Map(dtfs.map(d => [d.id, d])) };
  }, wallet ?? 'none');

  if (!wallet) {
    return (
      <Screen>
        <Empty
          title="Link a wallet to see your portfolio"
          body="Your baskets are held in your own wallet. Link one from Profile → Wallets."
        />
        <Button
          label="Go to Profile"
          variant="outline"
          onPress={() => router.navigate('/profile')}
        />
      </Screen>
    );
  }
  if (!data) return <LoadState error={error} onRetry={reload} />;

  const { portfolio, costBasis, activity, dtfs, source } = data;
  const positions = portfolio.positions;
  const marketValue = sum(positions.map(p => p.value));
  // Cost basis is only known when the API read model has wallet transactions.
  const hasCost = positions.some(p => costBasis[p.dtfId] !== undefined);
  const cost = sum(positions.map(p => costBasis[p.dtfId] ?? '0'));
  const pnl = sub(marketValue, cost);
  const pnlBps = ratioBps(pnl, cost);
  const tone =
    compare(pnl, '0') > 0 ? 'up' : compare(pnl, '0') < 0 ? 'down' : undefined;
  const nameOf = (id: string): Dtf | undefined => dtfs.get(id);

  if (positions.length === 0) {
    return (
      <Screen onRefresh={reload} refreshing={loading}>
        <Empty
          title="No positions yet"
          body="Baskets you invest in appear here."
        />
        <Button label="Explore baskets" onPress={() => router.navigate('/')} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Card banded>
        {source === 'chain' ? (
          <Text style={[type.small, { color: colors.muted }]}>
            Live on-chain balances — account valuations are still indexing.
          </Text>
        ) : null}
        <StatGrid>
          <Stat
            label="Market value"
            value={formatDecimal(marketValue)}
            hint={`across ${positions.length} baskets`}
          />
          <Stat
            label="Cost basis"
            value={hasCost ? formatDecimal(cost) : '—'}
          />
          <Stat
            label="Unrealized P&L"
            value={hasCost ? formatSigned(pnl) : '—'}
            hint={
              hasCost ? `${formatSignedBps(pnlBps)} since entry` : undefined
            }
            tone={hasCost ? tone : undefined}
          />
        </StatGrid>
      </Card>

      <Card title="Allocation by basket">
        <AllocationBar
          slices={positions.map(p => ({
            key: p.dtfId,
            label: nameOf(p.dtfId)?.name ?? p.dtfId,
            detail: formatDecimal(p.value),
            bps: ratioBps(p.value, marketValue),
          }))}
        />
      </Card>

      <Card title="Holdings">
        {positions.map((p, i) => {
          const dtf = nameOf(p.dtfId);
          const hasPositionCost = costBasis[p.dtfId] !== undefined;
          const positionPnl = hasPositionCost
            ? sub(p.value, costBasis[p.dtfId]!)
            : null;
          const up = positionPnl !== null && compare(positionPnl, '0') >= 0;
          return (
            <View key={p.dtfId} style={{ gap: space.sm }}>
              {i > 0 && <Divider />}
              <View style={styles.line}>
                <View style={styles.fill}>
                  <Text
                    style={[type.heading, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {dtf?.name ?? p.dtfId}
                  </Text>
                  <Mono size={12} color={colors.gold}>
                    {dtf?.symbol ?? ''}
                  </Mono>
                </View>
                <View style={styles.end}>
                  <Mono size={15}>{formatDecimal(p.value)}</Mono>
                  <Mono
                    size={12}
                    color={
                      positionPnl === null
                        ? colors.muted
                        : up
                          ? colors.green
                          : colors.danger
                    }
                  >
                    {positionPnl === null ? '—' : formatSigned(positionPnl)}
                  </Mono>
                </View>
              </View>
              <Text style={[type.small, { color: colors.muted }]}>
                {formatRaw(p.shares, dtf?.shareDecimals ?? 18, 4)} shares · NAV{' '}
                {formatDecimal(dtf?.sharePrice, 4)}
              </Text>
              <View style={styles.actions}>
                <Button
                  label="Invest"
                  style={styles.action}
                  onPress={() =>
                    router.push({
                      pathname: '/basket/[id]',
                      params: { id: p.dtfId, side: 'invest' },
                    })
                  }
                />
                <Button
                  label="Redeem"
                  variant="outline"
                  style={styles.action}
                  onPress={() =>
                    router.push({
                      pathname: '/basket/[id]',
                      params: { id: p.dtfId, side: 'redeem' },
                    })
                  }
                />
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Recent activity">
        {activity.length === 0 ? (
          <Empty title="No recent activity" />
        ) : (
          activity.map((tx, i) => {
            const dtf = nameOf(tx.dtfId);
            return (
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
                  <Text
                    style={[type.small, styles.fill, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {dtf?.name ?? '—'}
                  </Text>
                  <Mono size={12}>
                    {tx.amountRaw
                      ? formatRaw(tx.amountRaw, dtf?.baseAssetDecimals ?? 6)
                      : '—'}
                  </Mono>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { alignItems: 'flex-end' },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, minHeight: 40 },
});
