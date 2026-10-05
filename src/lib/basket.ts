/** Basket rules shared by Explore and Basket detail, matching the web app. */
import type { Asset, Dtf } from './types';

export type AssetMap = ReadonlyMap<string, Asset>;

export function assetMap(assets: readonly Asset[]): AssetMap {
  return new Map(assets.map(a => [a.id, a]));
}

/** Permissioned when the base asset's transfers are allowlisted or venue-gated. */
export function isPermissioned(dtf: Dtf, assets: AssetMap): boolean {
  const policy = assets.get(dtf.baseAssetId)?.underlyingTransferPolicy;
  return policy === 'issuer_allowlist' || policy === 'venue_gated';
}

export function isComingSoon(dtf: Dtf): boolean {
  return dtf.isPublished === false;
}

export function strategyOf(dtf: Dtf): string {
  return dtf.strategy?.type ?? 'standard';
}

export function symbolOf(assetId: string | null, assets: AssetMap): string {
  if (!assetId) return '—';
  return assets.get(assetId)?.symbol ?? assetId;
}
