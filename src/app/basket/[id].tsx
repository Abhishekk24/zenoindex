/** One basket: stats, NAV chart, allocation, fees, holdings, activity, trade (web: /dtfs/[id]). */
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { BasketActivity } from '../../components/basket/BasketActivity';
import { BasketHeader } from '../../components/basket/BasketHeader';
import { BasketHoldings } from '../../components/basket/BasketHoldings';
import { BasketStats } from '../../components/basket/BasketStats';
import { AllocationBar } from '../../components/charts/AllocationBar';
import { NavChart } from '../../components/charts/NavChart';
import { TradePanel } from '../../components/TradePanel';
import { Card, Empty, LoadState, Row, Screen } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useUser } from '../../hooks/useUser';
import * as api from '../../lib/api';
import {
  assetMap,
  isComingSoon,
  isPermissioned,
  strategyOf,
  symbolOf,
} from '../../lib/basket';
import {
  formatBps,
  formatDecimal,
  humanize,
  shortAddress,
} from '../../lib/format';

export default function BasketDetailScreen() {
  const params = useLocalSearchParams<{ id: string; side?: string }>();
  const id = params.id;
  // `side` arrives from a link, so only trust the two known values.
  const side =
    params.side === 'invest' || params.side === 'redeem'
      ? params.side
      : undefined;
  const user = useUser();
  const wallet =
    user.wallets.find(w => w.primary)?.address ??
    user.walletAddress ??
    user.wallets[0]?.address ??
    null;
  const { data, error, loading, reload } = useLoad(
    async () => {
      const [dtf, assets, eligibility] = await Promise.all([
        api.getDtf(id),
        api.listAssets(),
        api.getEligibility(wallet),
      ]);
      return { dtf, assets: assetMap(assets), eligibility };
    },
    `${id}#${wallet ?? 'none'}`,
  );

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
      <BasketHeader dtf={dtf} permissioned={permissioned} />
      <BasketStats dtf={dtf} baseSymbol={baseSymbol} />

      <Card title="NAV performance">
        {dtf.readModels.performance === 'unavailable' ? (
          <Empty
            title="Pricing is still indexing"
            body="NAV history appears once the indexer has priced this basket."
          />
        ) : (
          <NavChart points={dtf.performance} />
        )}
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
        onConfirmed={reload}
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

      <BasketHoldings dtf={dtf} assets={assets} />
      <BasketActivity dtf={dtf} assets={assets} />
    </Screen>
  );
}
