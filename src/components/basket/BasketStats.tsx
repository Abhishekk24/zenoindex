import React from 'react';

import {
  formatDate,
  formatDecimal,
  formatRaw,
  formatSignedBps,
} from '../../lib/format';
import type { DtfDetail } from '../../lib/types';
import { Card, Stat, StatGrid } from '../ui';

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
