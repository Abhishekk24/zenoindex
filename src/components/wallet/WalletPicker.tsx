/**
 * The app's own wallet picker (replaces Reown AppKit's modal): a sheet listing
 * wallet apps — the ones on this phone first, the last one used marked — plus
 * "Other wallet" for any other WalletConnect wallet. Picking one opens it to
 * approve the connection; the sheet then shows that wallet waiting.
 *
 * `chooseWallet()` opens it and resolves with the connected address, or null if
 * the user closes it. WalletPickerHost is mounted once at the root.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Hex } from 'viem';

import { colors, fonts, radius, space, type } from '../../theme/tokens';
import {
  cancelConnect,
  connectWallet,
  openWalletApp,
} from '../../wallets/externalWallet';
import {
  OTHER_WALLET,
  WALLET_APPS,
  type WalletApp,
} from '../../wallets/registry';
import { ChevronRightIcon, MoreIcon } from '../icons';
import { Button } from '../ui';

type Request = { resolve: (address: Hex | null) => void } | null;

let request: Request = null;
const listeners = new Set<() => void>();
const set = (next: Request) => {
  request = next;
  listeners.forEach(l => l());
};

/** The wallet app last connected from this phone, marked "Last used". */
const LAST_WALLET_KEY = '@zeno/last-wallet-app';

/** Opens the picker; resolves with the connected address, or null if closed. */
export function chooseWallet(): Promise<Hex | null> {
  request?.resolve(null);
  return new Promise(resolve => set({ resolve }));
}

export function WalletPickerHost() {
  const insets = useSafeAreaInsets();
  const open = useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => request,
  );
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<WalletApp>();
  const [error, setError] = useState<string>();

  // Which wallet apps are on this phone (schemes declared in app.json / plugin),
  // and which one was used last.
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all(
      WALLET_APPS.map(async app =>
        app.scheme &&
        (await Linking.canOpenURL(`${app.scheme}://`).catch(() => false))
          ? app.id
          : null,
      ),
    ).then(ids => {
      if (active) setInstalled(new Set(ids.filter((id): id is string => !!id)));
    });
    AsyncStorage.getItem(LAST_WALLET_KEY)
      .then(id => active && setLastUsed(id))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const close = (address: Hex | null) => {
    open?.resolve(address);
    set(null);
    setConnecting(undefined);
    setError(undefined);
  };

  const pick = async (app: WalletApp) => {
    setError(undefined);
    setConnecting(app);
    try {
      const address = await connectWallet(app);
      await AsyncStorage.setItem(LAST_WALLET_KEY, app.id).catch(() => {});
      close(address);
    } catch (e) {
      setConnecting(undefined);
      setError(e instanceof Error ? e.message : 'The wallet didn’t connect.');
    }
  };

  const cancel = () => {
    cancelConnect();
    close(null);
  };

  // On this phone first, the last one used at the top; the rest in list order.
  const onPhone = WALLET_APPS.filter(app => installed.has(app.id)).sort(
    (a, b) => Number(b.id === lastUsed) - Number(a.id === lastUsed),
  );
  const more = WALLET_APPS.filter(app => !installed.has(app.id));

  const row = (app: WalletApp, i: number) => (
    <Pressable
      key={app.id}
      onPress={() => void pick(app)}
      accessibilityRole="button"
      accessibilityLabel={`Connect ${app.name}`}
      style={({ pressed }) => [
        styles.row,
        i > 0 && styles.rowDivider,
        pressed && styles.pressed,
      ]}
    >
      <WalletLogo app={app} size={36} />
      <Text style={styles.name} numberOfLines={1}>
        {app.name}
      </Text>
      {app.id === lastUsed ? <Text style={styles.tag}>Last used</Text> : null}
      <ChevronRightIcon color={colors.dim} />
    </Pressable>
  );

  return (
    <Modal
      visible={open !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={cancel}
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.handle} />
        {connecting ? (
          <Waiting app={connecting} onCancel={cancel} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[type.title, styles.title]}>Connect a wallet</Text>
              <Text style={[type.small, styles.muted]}>
                Pick the wallet you use. It opens so you can approve, then come
                back to Zeno.
              </Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              bounces={false}
            >
              {onPhone.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>On this phone</Text>
                  <View style={styles.group}>{onPhone.map(row)}</View>
                </View>
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {onPhone.length > 0 ? 'More wallets' : 'Wallets'}
                </Text>
                <View style={styles.group}>{more.map(row)}</View>
              </View>
              <View style={styles.group}>
                <Pressable
                  onPress={() => void pick(OTHER_WALLET)}
                  accessibilityRole="button"
                  accessibilityLabel="Connect another WalletConnect wallet"
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <WalletLogo app={OTHER_WALLET} size={36} />
                  <View style={styles.otherText}>
                    <Text style={styles.otherName}>Other wallet</Text>
                    <Text style={styles.hint}>Any WalletConnect wallet</Text>
                  </View>
                  <ChevronRightIcon color={colors.dim} />
                </Pressable>
              </View>
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

/** The chosen wallet's logo in a spinning ring while the user approves. */
function Waiting({ app, onCancel }: { app: WalletApp; onCancel: () => void }) {
  const reduced = useReducedMotion();
  const name = app.id === OTHER_WALLET.id ? 'your wallet' : app.name;
  return (
    <View style={styles.waiting} accessibilityLiveRegion="polite">
      <View style={styles.ringWrap}>
        <View style={styles.ringTrack} />
        {/* Constant motion: linear. Reduced motion keeps the still track. */}
        {reduced ? null : <Animated.View style={styles.ringArc} />}
        <WalletLogo app={app} size={56} />
      </View>
      <View style={styles.waitingText}>
        <Text style={[type.title, styles.title, styles.center]}>
          Approve in {name}
        </Text>
        <Text style={[type.body, styles.muted, styles.center]}>
          Approve the connection, then come back to Zeno.
        </Text>
      </View>
      <View style={styles.waitingActions}>
        {app.scheme ? (
          <Button
            label={`Open ${app.name}`}
            variant="outline"
            onPress={() => void openWalletApp()}
          />
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

function WalletLogo({ app, size }: { app: WalletApp; size: number }) {
  const box = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
  };
  return app.logo ? (
    <Image source={app.logo} style={[styles.logo, box]} />
  ) : (
    <View style={[styles.logo, styles.logoBlank, box]}>
      <MoreIcon color={colors.textSecondary} size={18} />
    </View>
  );
}

const RING = 88;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineControl,
  },
  header: { gap: space.xs },
  title: { color: colors.text, fontFamily: fonts.medium },
  muted: { color: colors.muted },
  center: { textAlign: 'center' },
  error: { ...type.small, color: colors.danger },
  list: { flexGrow: 0 },
  listContent: { gap: space.lg },
  section: { gap: space.sm },
  sectionLabel: { ...type.label, color: colors.dim },
  group: {
    backgroundColor: colors.surface3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.line },
  name: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  otherText: { flex: 1, justifyContent: 'center', gap: 2 },
  otherName: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  hint: { ...type.small, color: colors.dim },
  tag: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.gold,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  logo: {
    // A faint outline keeps white logos (MetaMask) from melting into the row.
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoBlank: {
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: { alignItems: 'center', gap: space.xl, paddingTop: space.lg },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: colors.line,
  },
  ringArc: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.gold,
    animationName: {
      from: { transform: [{ rotate: '0deg' }] },
      to: { transform: [{ rotate: '360deg' }] },
    },
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  waitingText: { gap: space.sm, alignItems: 'center' },
  waitingActions: { alignSelf: 'stretch', gap: space.xs },
});
