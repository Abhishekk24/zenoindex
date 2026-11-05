import React from 'react';

import {
  formatDate,
  formatDecimal,
  formatRaw,
  formatSignedBps,
} from '../../lib/format';
import type { DtfDetail } from '../../lib/types';
import { Badge, Card, Stat, StatGrid } from '../ui';

function tone(bps?: number): 'up' | 'down' | undefined {
  if (bps === undefined || bps === 0) return undefined;
  return bps > 0 ? 'up' : 'down';
}

/** Basket detail headline figures: NAV, AUM, since inception, supply. */
export function BasketStats({
  dtf,
  baseSymbol,
}: {
  dtf: DtfDetail;
  baseSymbol: string;
}) {
  const inception = dtf.performanceDeltas.find(d => d.window === 'inception');
  const latest = dtf.performanceDeltas.find(d => d.window === 'latest');
  return (
    <Card
      action={
        // The day / since-inception changes come from the demo NAV history.
        dtf.demoStats ? <Badge label="Demo data" tone="gold" /> : undefined
      }
    >
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
        {/* shortcut: 4 decimals so testers see small total-NAV moves on tiny vaults; drop to 0 once real AUM is large */}
        <Stat label={`AUM · ${baseSymbol}`} value={formatDecimal(dtf.aum, 4)} />
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
