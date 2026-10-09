import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Mask,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

/** Diagonal stripes fading in from one side, as on the web cards' header bands. */
export function Stripes({
  height,
  fade = 'left',
  stripe = 5,
  gap = 8,
  opacity = 0.3,
}: {
  height: number;
  fade?: 'left' | 'down';
  stripe?: number;
  gap?: number;
  opacity?: number;
}) {
  const id = useId().replace(/:/g, '');
  const size = stripe + gap;
  const horizontal = fade === 'left';
  return (
    <Svg
      width="100%"
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id={`p${id}`}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect
            width={stripe}
            height={size}
            fill={`rgba(255,255,255,${opacity})`}
          />
        </Pattern>
        <LinearGradient
          id={`g${id}`}
          x1="0"
          y1="0"
          x2={horizontal ? '1' : '0'}
          y2={horizontal ? '0' : '1'}
        >
          <Stop
            offset={horizontal ? '0.35' : '0'}
            stopColor="#fff"
            stopOpacity={horizontal ? 0 : 1}
          />
          <Stop offset="1" stopColor="#fff" stopOpacity={horizontal ? 1 : 0} />
        </LinearGradient>
        <Mask id={`m${id}`}>
          <Rect width="100%" height="100%" fill={`url(#g${id})`} />
        </Mask>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        fill={`url(#p${id})`}
        mask={`url(#m${id})`}
      />
    </Svg>
  );
}
