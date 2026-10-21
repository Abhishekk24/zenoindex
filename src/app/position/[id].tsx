/**
 * One of the wallet's positions: value, P&L, shares, entry price, its share of
 * the portfolio and the wallet's transactions in this basket. Opened from
 * Portfolio → Holdings and from the basket page's "Your position" card.
 * Cost figures show "—" until the API has the wallet's invest history.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  LinkText,
  LoadState,
  Mono,
  Row,
  Screen,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useUser } from '../../hooks/useUser';
import { explorerTxUrl } from '../../lib/chain';
import { compare, div, fromRaw, ratioBps, sub, sum } from '../../lib/decimal';
import {
  formatBps,
  formatDate,
  formatDecimal,
  formatRaw,
  formatSignedBps,
  humanize,
} from '../../lib/format';
import { signedUsd, usd } from '../../lib/money';
import { loadPortfolio } from '../../lib/portfolio';
import { primaryWallet } from '../../lib/user';
import { colors, fonts, space, type } from '../../theme/tokens';

export default function PositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = primaryWallet(useUser());
  const { data, error, loading, reload } = useLoad(
    async () => (wallet ? loadPortfolio(wallet) : null),
    `${wallet ?? 'none'}#${id}`,
  );

  if (!wallet) {
    return (
      <Screen>
        <Empty
          title="Link a wallet to see this position"
          body="Your baskets are held in your own wallet. Link one from Profile → Wallets."
        />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <LoadState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const dtf = data.dtfs.get(id);
  const position = data.portfolio.positions.find(p => p.dtfId === id);
  const open = (side: 'invest' | 'redeem') =>
    router.push({ pathname: '/basket/[id]', params: { id, side } });

  if (!dtf || !position) {
    return (
      <Screen onRefresh={reload} refreshing={loading}>
        <Empty
          title="You don’t hold this basket"
          body="Shares you buy appear here once the transaction confirms."
        />
        <Button label="Open basket" onPress={() => open('invest')} />
      </Screen>
    );
  }

  const shares = fromRaw(position.shares, dtf.shareDecimals);
  const total = sum(data.portfolio.positions.map(p => p.value));
  const basis = data.costBasis[id];
  const pnl = basis !== undefined ? sub(position.value, basis) : null;
  const up = pnl !== null && compare(pnl, '0') >= 0;
  const txs = data.activity.filter(tx => tx.dtfId === id);
  const first = txs.reduce<string | undefined>(
    (earliest, tx) =>
      !earliest || tx.occurredAt < earliest ? tx.occurredAt : earliest,
    undefined,
  );

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <View style={styles.header}>
        <Mono color={colors.gold}>{dtf.symbol}</Mono>
        <Text style={styles.name}>{dtf.name}</Text>
      </View>

      <Card>
        <Text style={styles.label}>CURRENT VALUE</Text>
        <Text style={styles.value}>{usd(position.value)}</Text>
        {pnl !== null ? (
          <Text style={[styles.pnl, { color: up ? colors.green : colors.red }]}>
            {up ? '▲' : '▼'} {signedUsd(pnl)}
            {compare(basis!, '0') > 0
              ? ` · ${formatSignedBps(ratioBps(pnl, basis!))}`
              : ''}{' '}
            all time
          </Text>
        ) : null}
      </Card>

      <Card>
        <Row label="Shares held" value={formatDecimal(shares, 4)} />
        <Row
          label="Current NAV / share"
          value={formatDecimal(dtf.sharePrice, 4)}
        />
        <Row
          label="Avg entry NAV"
          value={
            basis !== undefined && compare(shares, '0') > 0
              ? formatDecimal(div(basis, shares), 4)
              : '—'
          }
        />
        <Row
          label="Cost basis"
          value={basis !== undefined ? usd(basis) : '—'}
        />
        <Row
          label="Share of portfolio"
          value={formatBps(ratioBps(position.value, total), 1)}
        />
        <Row label="First invested" value={first ? formatDate(first) : '—'} />
      </Card>

      <Card title="Your transactions">
        {txs.length === 0 ? (
          <Empty
            title="No indexed transactions yet"
            body="Your invests and redeems in this basket appear once indexed."
          />
        ) : (
          txs.map((tx, i) => (
            <View key={tx.id} style={styles.tx}>
              {i > 0 && <Divider />}
              <View style={styles.line}>
                <Badge
                  label={humanize(tx.action)}
                  tone={tx.action === 'invest' ? 'green' : 'neutral'}
                />
                <Text style={styles.date}>{formatDate(tx.occurredAt)}</Text>
              </View>
              <View style={styles.line}>
                <Text style={styles.date}>
                  {tx.shareAmountRaw
                    ? `${formatRaw(tx.shareAmountRaw, dtf.shareDecimals, 4)} ${
                        dtf.symbol
                      }`
                    : ''}
                </Text>
                <Mono size={12}>
                  {tx.amountRaw
                    ? usd(fromRaw(tx.amountRaw, dtf.baseAssetDecimals))
                    : '—'}
                </Mono>
              </View>
              {tx.txHash ? (
                <LinkText
                  label="Explorer"
                  size={12}
                  url={explorerTxUrl(tx.chainId || dtf.chainId, tx.txHash)}
                />
              ) : null}
            </View>
          ))
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Redeem"
          variant="outline"
          onPress={() => open('redeem')}
          style={styles.action}
        />
        <Button
          label="Invest more"
          variant="green"
          onPress={() => open('invest')}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, paddingTop: space.md },
  name: { ...type.display, color: colors.text },
  label: { ...type.label, color: colors.muted },
  value: { fontFamily: fonts.regular, fontSize: 30, color: colors.text },
  pnl: { ...type.small },
  tx: { gap: space.xs },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  date: { ...type.small, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1 },
});
