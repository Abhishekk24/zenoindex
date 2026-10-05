/**
 * Invest / Redeem, as far as the preview. Signing comes with wallet
 * connection: the API returns a draft transaction and the user's wallet
 * signs it; the app never moves funds itself.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import * as api from '../lib/api';
import { compare, isDecimal, isPositive } from '../lib/decimal';
import { formatBps, formatDecimal, shortAddress } from '../lib/format';
import type { Dtf, TradePreview } from '../lib/types';
import { colors, space, type } from '../theme/tokens';
import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  Field,
  Label,
  Row,
  Segmented,
} from './ui';

type Side = TradePreview['side'];

const SIDES = [
  { value: 'invest', label: 'Invest' },
  { value: 'redeem', label: 'Redeem' },
] as const;

export function TradePanel({
  dtf,
  baseSymbol,
  initialSide = 'invest',
  disabledReason,
  notice,
}: {
  dtf: Dtf;
  baseSymbol: string;
  initialSide?: Side;
  /** Set when the basket can't be traded at all (e.g. coming soon). */
  disabledReason?: string;
  /** Shown above the form, e.g. eligibility or wallet still needed. */
  notice?: string;
}) {
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  // A preview (or its error) is only valid for the inputs it was made from,
  // so it is kept with them and hidden as soon as either input changes.
  const [result, setResult] = useState<{
    inputs: string;
    preview?: TradePreview;
    error?: string;
  }>();
  const inputs = `${side}|${amount}`;
  const current = result?.inputs === inputs ? result : undefined;
  const preview = current?.preview;
  const error = current?.error;

  const unit = side === 'invest' ? baseSymbol : dtf.symbol;
  const valid = isDecimal(amount) && isPositive(amount);
  const belowMinimum =
    side === 'invest' &&
    valid &&
    Boolean(dtf.minInvestment) &&
    compare(amount, dtf.minInvestment!) < 0;

  const review = async () => {
    setBusy(true);
    try {
      setResult({ inputs, preview: await api.previewTrade(dtf, side, amount) });
    } catch (e) {
      setResult({
        inputs,
        error: e instanceof Error ? e.message : 'Could not prepare a preview.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Invest or redeem" banded>
      {disabledReason ? (
        <Body muted>{disabledReason}</Body>
      ) : (
        <>
          <Segmented options={SIDES} value={side} onChange={setSide} />
          {notice ? <Badge label={notice} tone="gold" /> : null}
          <Field
            label={
              side === 'invest'
                ? `You pay (${baseSymbol})`
                : `Shares to redeem (${dtf.symbol})`
            }
            value={amount}
            onChangeText={text =>
              setAmount(text.replace(',', '.').replace(/[^\d.]/g, ''))
            }
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          {side === 'invest' && dtf.minInvestment ? (
            <Text
              style={[
                type.small,
                { color: belowMinimum ? colors.danger : colors.muted },
              ]}
            >
              Minimum investment {formatDecimal(dtf.minInvestment)} {baseSymbol}
            </Text>
          ) : null}
          <Button
            label="Review"
            onPress={review}
            disabled={!valid || belowMinimum}
            loading={busy}
          />
          {error ? (
            <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
          ) : null}
        </>
      )}

      {preview && (
        <View style={{ gap: space.sm }}>
          <Divider />
          <Label accent>Preview</Label>
          <Row
            label="You pay"
            value={`${formatDecimal(preview.pay, 4)} ${unit}`}
          />
          <Row
            label={side === 'invest' ? 'Entry fee' : 'Exit fee'}
            value={`${formatDecimal(preview.fee, 4)} (${formatBps(
              preview.feeBps,
            )})`}
          />
          <Row
            label="Quoted NAV / share"
            value={formatDecimal(preview.quotedSharePrice, 6)}
          />
          <Row
            label={side === 'invest' ? 'Expected shares' : 'You receive'}
            value={`${formatDecimal(preview.receive, 4)} ${
              side === 'invest' ? dtf.symbol : baseSymbol
            }`}
          />
          <Divider />
          <Label>Transaction draft</Label>
          <Row label="To" value={shortAddress(preview.draft.transaction.to)} />
          <Row
            label="Chain"
            value={String(preview.draft.transaction.chainId)}
          />
          <Row label="Gas limit" value={preview.draft.transaction.gas ?? '—'} />
          <Button
            label="Sign with wallet · coming soon"
            variant="green"
            disabled
          />
          <Text style={[type.small, { color: colors.dim }]}>
            The final amounts are set by the quote when you sign. Prices can
            move before then.
          </Text>
        </View>
      )}
    </Card>
  );
}
