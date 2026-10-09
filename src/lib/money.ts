/**
 * Dollar display for amounts in the baskets' USD stablecoin base asset.
 * Values stay decimal strings (see lib/decimal.ts, lib/format.ts).
 */
import { compare } from './decimal';
import { formatDecimal } from './format';

/** "1250.52" → "$1,250.52"; "-10.79" → "-$10.79". */
export function usd(value: string): string {
  const text = formatDecimal(value);
  return text.startsWith('-') ? `-$${text.slice(1)}` : `$${text}`;
}

/** Signed dollars: "+$39.73", "-$10.79", "$0.00". */
export function signedUsd(value: string): string {
  return compare(value, '0') > 0 ? `+${usd(value)}` : usd(value);
}
