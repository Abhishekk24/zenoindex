/** Basket rules shared by Explore and Basket detail, matching the web app. */
import type { Asset, Dtf } from './types';

export type AssetMap = ReadonlyMap<string, Asset>;

/**
 * Keys are lowercased: the API identifies assets by contract address, which
 * arrives lowercase on assets but checksummed inside DTF weights.
 */
export function assetMap(assets: readonly Asset[]): AssetMap {
  return new Map(assets.map(a => [a.id.toLowerCase(), a]));
}

const getAsset = (assets: AssetMap, id: string | null | undefined) =>
  id ? assets.get(id.toLowerCase()) : undefined;

/** Permissioned when the base asset's transfers are allowlisted or venue-gated. */
export function isPermissioned(dtf: Dtf, assets: AssetMap): boolean {
  const policy = getAsset(assets, dtf.baseAssetId)?.underlyingTransferPolicy;
  return policy === 'issuer_allowlist' || policy === 'venue_gated';
}

export function isComingSoon(dtf: Dtf): boolean {
  return dtf.isPublished === false || dtf.lifecycle === 'coming_soon';
}

export function strategyOf(dtf: Dtf): string {
  return dtf.strategy?.type ?? 'standard';
}

export function symbolOf(
  assetId: string | null | undefined,
  assets: AssetMap,
): string {
  if (!assetId) return '—';
  return getAsset(assets, assetId)?.symbol ?? assetId;
}
