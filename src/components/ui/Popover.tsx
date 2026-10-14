import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, radius, space } from '../../theme/tokens';

type Anchor = { x: number; y: number; width: number; height: number };

/**
 * A trigger that opens a small dark card anchored under its right edge, over
 * everything (card ⋮ menus, ⓘ tooltips). A tap outside closes it.
 */
export function Popover({
  trigger,
  children,
  width = 210,
  accessibilityLabel,
  hitSlop = 8,
}: {
  trigger: React.ReactNode;
  /** Card content; call `close` after an action. */
  children: (close: () => void) => React.ReactNode;
  width?: number;
  accessibilityLabel: string;
  hitSlop?: number;
}) {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const window = useWindowDimensions();

  const open = () =>
    ref.current?.measureInWindow((x, y, w, h) =>
      setAnchor({ x, y, width: w, height: h }),
    );
  const close = () => setAnchor(null);

  // Right-aligned under the trigger, kept on screen.
  const left = anchor
    ? Math.min(
        Math.max(space.md, anchor.x + anchor.width - width),
        window.width - width - space.md,
      )
    : 0;
  const top = anchor ? anchor.y + anchor.height + 6 : 0;

  return (
    <>
      <Pressable
        ref={ref}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: anchor !== null }}
        hitSlop={hitSlop}
      >
        {trigger}
      </Pressable>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Close"
        />
        <View style={[styles.card, { top, left, width }]}>
          {children(close)}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: '#101312',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingVertical: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});
