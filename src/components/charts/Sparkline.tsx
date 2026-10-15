/**
 * A basket's recent share price as a small line with a soft fill under it,
 * green when it ended higher than it started, red when lower. Sizes itself to
 * the width it's given.
 */
import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../../theme/tokens';

export function Sparkline({
  values,
  height = 44,
  style,
}: {
  /** Oldest first. */
  values: number[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const up = values.length < 2 || values.at(-1)! >= values[0]!;
  const color = up ? colors.green : colors.red;

  let line = '';
  let area = '';
  if (width > 0 && values.length >= 2) {
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    const pad = 3; // keeps the stroke inside the box
    const pts = values.map((v, i) => [
      (i / (values.length - 1)) * width,
      pad + (1 - (v - min) / span) * (height - pad * 2),
    ]);
    line = pts
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)},${y!.toFixed(1)}`)
      .join(' ');
    area = `${line} L${width},${height} L0,${height} Z`;
  }

  return (
    <View
      style={[{ height }, style]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {line ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#fill)" />
          <Path
            d={line}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
