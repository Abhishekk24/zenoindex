/** One basket: stats, NAV chart, allocation, fees, holdings, activity, trade (web: /dtfs/[id]). */
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';

import { BasketActivity } from '../../components/basket/BasketActivity';
import { BasketCorporateActions } from '../../components/basket/BasketCorporateActions';
import { BasketHeader } from '../../components/basket/BasketHeader';
import { BasketHoldings } from '../../components/basket/BasketHoldings';
import { BasketPageSkeleton } from '../../components/basket/BasketPageSkeleton';
import { BasketPosition } from '../../components/basket/BasketPosition';
import { BasketStats } from '../../components/basket/BasketStats';
import { AllocationBar } from '../../components/charts/AllocationBar';
import { ManagerActions } from '../../components/manager/ManagerActions';
import { NavChart } from '../../components/charts/NavChart';
import { TradePanel } from '../../components/TradePanel';
import {
  Badge,
  Card,
  Empty,
  LinkText,
  LoadState,
  Row,
  Screen,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useUser } from '../../hooks/useUser';
import * as api from '../../lib/api';
import { useAppMode } from '../../lib/appMode';
import {
  assetMap,
  isComingSoon,
  isPermissioned,
  strategyOf,
  symbolOf,
} from '../../lib/basket';
import { chainName, explorerAddressUrl } from '../../lib/chain';
import {
  formatBps,
  formatDecimal,
  humanize,
  shortAddress,
} from '../../lib/format';
import { primaryWallet } from '../../lib/user';

export default function BasketDetailScreen() {
  const params = useLocalSearchParams<{ id: string; side?: string }>();
  const id = params.id;
  // `side` arrives from a link, so only trust the two known values.
  const side =
    params.side === 'invest' || params.side === 'redeem'
      ? params.side
      : undefined;
  const user = useUser();
  const wallet = primaryWallet(user);
  const { mode } = useAppMode();
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
  // Bumped on refresh and after a trade so the position re-reads the chain.
  const [version, setVersion] = useState(0);
  const refresh = () => {
    setVersion(v => v + 1);
    reload();
  };

  if (!data) {
    return (
      <Screen>
        <LoadState
          error={error}
          onRetry={reload}
          placeholder={<BasketPageSkeleton />}
        />
      </Screen>
    );
  }
  const { dtf, assets, eligibility } = data;
  const permissioned = isPermissioned(dtf, assets);
  const baseSymbol = symbolOf(dtf.baseAssetId, assets);
  // Actual weights come from the indexed holdings, when available.
  const actual = new Map(
    dtf.holdings.map(h => [h.assetId.toLowerCase(), h.actualWeightBps]),
  );

  const notice =
    user.wallets.length === 0
      ? 'Link a wallet in Profile to sign'
      : permissioned && eligibility.kycStatus !== 'verified'
        ? 'Eligibility check needed to sign'
        : undefined;

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <BasketHeader dtf={dtf} permissioned={permissioned} />
      {mode === 'manager' ? (
        <ManagerActions dtf={dtf} onSeeded={refresh} />
      ) : null}
      <BasketStats dtf={dtf} baseSymbol={baseSymbol} />
      {wallet ? (
        <BasketPosition dtf={dtf} wallet={wallet} version={version} />
      ) : null}

      <Card
        title="NAV performance"
        action={
          dtf.demoStats ? <Badge label="Demo data" tone="gold" /> : undefined
        }
      >
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
            actualBps: actual.get(w.assetId.toLowerCase()) ?? undefined,
          }))}
        />
      </Card>

      <TradePanel
        dtf={dtf}
        baseSymbol={baseSymbol}
        initialSide={side}
        notice={notice}
        priceStale={dtf.priceStale}
        onConfirmed={refresh}
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
        <Row label="Network" value={chainName(dtf.chainId)} mono={false} />
        {dtf.priceSource ? (
          <Row label="Price source" value={dtf.priceSource} mono={false} />
        ) : null}
        {dtf.contractAddress ? (
          <Row
            label="Contract"
            value={
              <LinkText
                mono
                label={shortAddress(dtf.contractAddress)}
                url={explorerAddressUrl(dtf.chainId, dtf.contractAddress)}
              />
            }
          />
        ) : null}
      </Card>

      <BasketHoldings dtf={dtf} assets={assets} />
      <BasketCorporateActions dtf={dtf} assets={assets} />
      <BasketActivity dtf={dtf} assets={assets} />
    </Screen>
  );
}
