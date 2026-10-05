/**
 * Display formatting. formatDecimal and shortAddress are ported from
 * programmable-dtf-infra apps/dtf-app/lib/format.ts; keep them in step.
 */
import { fromRaw } from './decimal';

/**
 * Formats a decimal string with grouping and a fixed number of fraction
 * digits, rounding half-up. Works on the string digits (via BigInt) so display
 * never passes a monetary value through binary floating point (spec 7.4.4).
 * Returns "—" for anything that is not a plain decimal string.
 */
export function formatDecimal(
  value: string | undefined | null,
  digits = 2,
): string {
  if (!value || !/^-?\d+(\.\d+)?$/.test(value)) return '—';
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const scaled = BigInt(
    whole + fraction.padEnd(digits + 1, '0').slice(0, digits + 1),
  );
  const rounded = (scaled + BigInt(5)) / BigInt(10);
  const text = rounded.toString().padStart(digits + 1, '0');
  const integer = text
    .slice(0, text.length - digits)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = digits > 0 ? `.${text.slice(text.length - digits)}` : '';
  const sign = negative && rounded !== BigInt(0) ? '-' : '';
  return `${sign}${integer}${decimals}`;
}

/** Shortens a 0x address to `0xf39Fd6e…F4ce`; other strings are truncated. */
export function shortAddress(value: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return `${value.slice(0, 9)}…${value.slice(-4)}`;
  }
  return value.length <= 24 ? value : `${value.slice(0, 22)}…`;
}

/** Base units with `decimals` places, formatted: ("4800" + 18 zeros, 18) -> "4,800.00". */
export function formatRaw(
  raw: string | null | undefined,
  decimals: number,
  digits = 2,
): string {
  if (!raw || !/^-?\d+$/.test(raw)) return '—';
  return formatDecimal(fromRaw(raw, decimals), digits);
}

/** Basis points as a percentage: 50 -> "0.50%". */
export function formatBps(bps: number | null | undefined, digits = 2): string {
  if (bps === null || bps === undefined) return '—';
  return `${formatDecimal(fromRaw(String(bps), 2), digits)}%`;
}

/** Basis points as a signed change: 58 -> "+0.58%", -12 -> "-0.12%". */
export function formatSignedBps(bps: number, digits = 2): string {
  return `${bps > 0 ? '+' : ''}${formatBps(bps, digits)}`;
}

/** A decimal string with an explicit sign: "39.73" -> "+39.73". */
export function formatSigned(value: string, digits = 2): string {
  const text = formatDecimal(value, digits);
  return text.startsWith('-') || text === '—' || /^0\.?0*$/.test(text)
    ? text
    : `+${text}`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** ISO timestamp -> "29 Sep 2026" (UTC, so it matches the indexer's day). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getUTCDate()} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

/** "market-cap-weighted" -> "Market cap weighted". */
export function humanize(value: string): string {
  const text = value.replace(/[-_]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
