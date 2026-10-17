/**
 * The app's own alert, replacing the native one: a dark card over everything
 * with the Zeno look. `alert()` has Alert.alert's shape so call sites just
 * swap the import; DialogHost is mounted once at the root (app/_layout.tsx).
 */
import React, { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { Button } from './Button';

type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel';
};
type DialogState = {
  title: string;
  message?: string;
  buttons: DialogButton[];
} | null;

let state: DialogState = null;
const listeners = new Set<() => void>();
const set = (next: DialogState) => {
  state = next;
  listeners.forEach(l => l());
};

export function alert(
  title: string,
  message?: string,
  buttons: DialogButton[] = [{ text: 'OK' }],
) {
  set({ title, message, buttons });
}

export function DialogHost() {
  const dialog = useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
  const cancel = dialog?.buttons.find(b => b.style === 'cancel');
  const dismiss = () => {
    set(null);
    cancel?.onPress?.();
  };
  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismiss}
        accessibilityLabel="Close"
      />
      {dialog ? (
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={[type.title, styles.title]}>{dialog.title}</Text>
            {dialog.message ? (
              <Text style={[type.body, styles.message]}>{dialog.message}</Text>
            ) : null}
            <View style={styles.actions}>
              {dialog.buttons.map(b => (
                <Button
                  key={b.text}
                  label={b.text}
                  variant={b.style === 'cancel' ? 'outline' : 'gold'}
                  style={styles.action}
                  onPress={() => {
                    set(null);
                    b.onPress?.();
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: space.xl,
    gap: space.md,
  },
  title: { color: colors.text, fontFamily: fonts.medium },
  message: { color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  action: { flex: 1, minHeight: 44 },
});
