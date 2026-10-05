/**
 * Decimal-string arithmetic on BigInt, so money never passes through binary
 * floating point (spec 7.4.4). A small stand-in for @dtf/decimal: values are
 * held as integers scaled by 10^18; anything finer is truncated.
 */

const SCALE = 18;
const ONE = 10n ** BigInt(SCALE);
const DECIMAL = /^-?\d+(\.\d+)?$/;

export function isDecimal(value: string): boolean {
  return DECIMAL.test(value);
}

function toUnits(value: string): bigint {
  if (!isDecimal(value)) throw new Error(`Not a decimal string: ${value}`);
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const units = BigInt(whole + fraction.padEnd(SCALE, '0').slice(0, SCALE));
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const text = (negative ? -units : units).toString().padStart(SCALE + 1, '0');
  const whole = text.slice(0, -SCALE);
  const fraction = text.slice(-SCALE).replace(/0+$/, '');
  const body = fraction ? `${whole}.${fraction}` : whole;
  return negative && units !== 0n ? `-${body}` : body;
}

/** Integer base units ("1250000000") with `decimals` places -> "1250". */
export function fromRaw(raw: string, decimals: number): string {
  if (!/^-?\d+$/.test(raw)) throw new Error(`Not an integer string: ${raw}`);
  const negative = raw.startsWith('-');
  const digits = raw.replace('-', '').padStart(decimals + 1, '0');
  const whole = decimals > 0 ? digits.slice(0, -decimals) : digits;
  const fraction = decimals > 0 ? digits.slice(-decimals) : '';
  return fromUnits(
    toUnits(`${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`),
  );
}

export function add(a: string, b: string): string {
  return fromUnits(toUnits(a) + toUnits(b));
}

export function sub(a: string, b: string): string {
  return fromUnits(toUnits(a) - toUnits(b));
}

export function sum(values: readonly string[]): string {
  return fromUnits(values.reduce((total, v) => total + toUnits(v), 0n));
}

/** a × b, truncated to 18 places. */
export function mul(a: string, b: string): string {
  return fromUnits((toUnits(a) * toUnits(b)) / ONE);
}

/** value × bps / 10 000, e.g. a fee on an amount. */
export function mulBps(value: string, bps: number): string {
  return fromUnits((toUnits(value) * BigInt(bps)) / 10_000n);
}

/** a ÷ b, truncated to 18 places. Throws on division by zero. */
export function div(a: string, b: string): string {
  const divisor = toUnits(b);
  if (divisor === 0n) throw new Error('Division by zero');
  return fromUnits((toUnits(a) * ONE) / divisor);
}

/** part ÷ whole in basis points (rounded down); 0 when whole is zero. */
export function ratioBps(part: string, whole: string): number {
  const divisor = toUnits(whole);
  if (divisor === 0n) return 0;
  return Number((toUnits(part) * 10_000n) / divisor);
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const diff = toUnits(a) - toUnits(b);
  return diff === 0n ? 0 : diff < 0n ? -1 : 1;
}

export function isPositive(value: string): boolean {
  return isDecimal(value) && toUnits(value) > 0n;
}
