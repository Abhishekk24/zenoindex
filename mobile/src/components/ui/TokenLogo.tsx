import React, { useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * A token's logo, or `fallback` when it has none or the image fails to load
 * (e.g. a ticker the logo source doesn't know).
 */
export function TokenLogo({
  uri,
  style,
  fallback = null,
}: {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <>{fallback}</>;
  return (
    <Image source={{ uri }} style={style} onError={() => setFailed(true)} />
  );
}
