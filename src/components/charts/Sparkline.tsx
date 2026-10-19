/**
 * A basket's recent share price as a small line with a soft fill under it,
 * green when it ended higher than it started, red when lower. Sizes itself to
 * the width it's given.
 *
 * - Smooth monotone curve: it never overshoots the real highs and lows, so
 *   the shape stays honest while reading as a price trend, not a zig-zag.
 * - Faint dashed line at the starting price: up or down reads at a glance,
 *   not only from the colour.
 * - A dot with a soft halo marks the latest price.
 * - Flat history draws a level line through the middle.
 */
import React, { useId, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { colors } from '../../theme/tokens';

type Point = [x: number, y: number];

/**
 * Monotone cubic (Fritsch–Carlson) through the points: smooth, and never
 * bulging above a peak or below a dip the data doesn't have.
 */
function smoothPath(pts: Point[]): string {
  const n = pts.length;
  if (n < 3) {
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1]![0] - pts[i]![0];
    slope[i] = (pts[i + 1]![1] - pts[i]![1]) / dx[i]!;
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent[i] =
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
          ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
  }
  tangent[n - 1] = slope[n - 2]!;

  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + tangent[i]! * h).toFixed(1)} ${(
      x1 - h
    ).toFixed(1)},${(y1 - tangent[i + 1]! * h).toFixed(1)} ${x1.toFixed(
      1,
    )},${y1.toFixed(1)}`;
  }
  return d;
}

/** Room for the end dot's halo, so it never clips at the edges. */
const PAD = 5;
const DOT = 2.75;
const HALO = 5;

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
  // Unique per card: SVG ids are document-wide on some platforms.
  const id = `spark${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [width, setWidth] = useState(0);

  const first = values[0];
  const last = values.at(-1);
  const flat =
    values.length >= 2 && Math.max(...values) - Math.min(...values) === 0;
  const up = values.length < 2 || last! >= first!;
  const color = flat ? colors.muted : up ? colors.green : colors.red;

  let line = '';
  let area = '';
  let end: Point | null = null;
  let baseY = 0;
  if (width > 0 && values.length >= 2) {
    const min = Math.min(...values);
    const span = Math.max(...values) - min;
    const toY = (v: number) =>
      span === 0
        ? height / 2
        : PAD + (1 - (v - min) / span) * (height - PAD * 2);
    const usable = width - HALO;
    const pts: Point[] = values.map((v, i) => [
      (i / (values.length - 1)) * usable,
      toY(v),
    ]);
    line = smoothPath(pts);
    area = `${line} L${pts.at(-1)![0].toFixed(1)},${height} L0,${height} Z`;
    end = pts.at(-1)!;
    baseY = toY(first!);
  }

  return (
    <View
      style={[{ height }, style]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {line && end ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.24} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {flat ? null : (
            <Line
              x1={0}
              x2={end[0]}
              y1={baseY}
              y2={baseY}
              stroke={colors.lineControl}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}
          <Path d={area} fill={`url(#${id})`} />
          <Path
            d={line}
            stroke={color}
            strokeWidth={1.75}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={end[0]}
            cy={end[1]}
            r={HALO}
            fill={color}
            opacity={0.18}
          />
          <Circle cx={end[0]} cy={end[1]} r={DOT} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}
