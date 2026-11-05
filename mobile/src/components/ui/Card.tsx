import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, space } from '../../theme/tokens';
import { Stripes } from './Stripes';
import { Title } from './Title';

type CardProps = {
  children: React.ReactNode;
  title?: string;
  /** Right side of the title row. */
  action?: React.ReactNode;
  /** Show the striped header band. */
  banded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Bordered surface card, optionally with a striped band and a title row. */
export function Card({
  children,
  title,
  action,
  banded,
  onPress,
  style,
}: CardProps) {
  const body = (
    <>
      {banded && (
        <View style={styles.band}>
          <Stripes height={44} />
        </View>
      )}
      <View style={styles.body}>
        {(title || action) && (
          <View style={styles.header}>
            {title ? <Title>{title}</Title> : <View />}
            {action}
          </View>
        )}
        {children}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pressed: { borderColor: colors.goldLine },
  band: { height: 44, backgroundColor: colors.surface2 },
  body: { padding: space.lg, gap: space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
