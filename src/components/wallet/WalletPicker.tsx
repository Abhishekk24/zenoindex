/**
 * The app's own wallet picker (replaces Reown AppKit's modal): a sheet listing
 * wallet apps — the ones on this phone first, the last one used marked — plus
 * "Other wallet" for any other WalletConnect wallet. Picking one opens it to
 * approve the connection; the sheet then shows that wallet waiting.
 *
 * `chooseWallet()` opens it and resolves with how it ended: connected, the
 * connection cancelled, or the sheet closed without trying. Connection
 * problems are shown in the sheet (ui/Notice) so the user can retry or pick
 * another wallet. WalletPickerHost is mounted once at the root.
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

import {
  canDetectWallets,
  installedWallets,
} from '../../../modules/wallet-detector';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import {
  cancelWalletRequest,
  connectWallet,
  openWalletApp,
  toWalletError,
  useExternalWallet,
  walletName,
  warmUp,
} from '../../wallets/externalWallet';
import {
  CATALOGUE_APPS,
  detectedApp,
  OTHER_WALLET,
  WALLET_APPS,
  type WalletApp,
} from '../../wallets/registry';
import { ChevronRightIcon, MoreIcon } from '../icons';
import { Button } from '../ui';
import { Notice, type NoticeContent } from '../ui/Notice';

export type PickResult =
  | { status: 'connected'; address: Hex; app: WalletApp }
  | { status: 'cancelled'; app: WalletApp }
  | { status: 'closed' };

type Request = { resolve: (result: PickResult) => void } | null;

let request: Request = null;
const listeners = new Set<() => void>();
const set = (next: Request) => {
  request = next;
  listeners.forEach(l => l());
};

/** The wallet app last connected from this phone, marked "Last used". */
const LAST_WALLET_KEY = '@zeno/last-wallet-app';

/**
 * The wallet apps on this phone. Android lists every app that opens
 * WalletConnect links (and the default one); iOS can't list apps, so the
 * known and catalogue wallets are checked by scheme (declared in app.json).
 */
async function findWallets(): Promise<{
  apps: WalletApp[];
  defaultId?: string;
}> {
  if (canDetectWallets) {
    const found = await installedWallets();
    const apps = found.map(detectedApp);
    const preferred = found.find(f => f.isDefault);
    return {
      apps,
      defaultId: preferred ? detectedApp(preferred).id : undefined,
    };
  }
  const answers = await Promise.all(
    [...WALLET_APPS, ...CATALOGUE_APPS].map(async app =>
      app.scheme &&
      (await Linking.canOpenURL(`${app.scheme}://`).catch(() => false))
        ? app
        : null,
    ),
  );
  return { apps: answers.filter((app): app is WalletApp => app !== null) };
}

/** Opens the picker; resolves with how it ended. */
export function chooseWallet(): Promise<PickResult> {
  request?.resolve({ status: 'closed' });
  return new Promise(resolve => set({ resolve }));
}

export function WalletPickerHost() {
  const insets = useSafeAreaInsets();
  const open = useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => request,
  );
  // The wallets on this phone: every WalletConnect wallet on Android
  // (modules/wallet-detector), the known ones that answer to their scheme
  // elsewhere; and the one the phone opens WalletConnect links in by default.
  const [onPhone, setOnPhone] = useState<WalletApp[]>([]);
  const [defaultId, setDefaultId] = useState<string>();
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<WalletApp>();
  const [notice, setNotice] = useState<NoticeContent>();
  const { stalled, status, peer } = useExternalWallet();

  // Which wallet apps are on this phone, and which one was used last.
  useEffect(() => {
    if (!open) return;
    let active = true;
    // Opens the relay socket now, so the connection request goes out at once.
    void warmUp();
    findWallets().then(found => {
      if (!active) return;
      setOnPhone(found.apps);
      setDefaultId(found.defaultId);
    });
    AsyncStorage.getItem(LAST_WALLET_KEY)
      .then(id => active && setLastUsed(id))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const close = (result: PickResult) => {
    open?.resolve(result);
    set(null);
    setConnecting(undefined);
    setNotice(undefined);
  };

  const pick = async (app: WalletApp) => {
    setNotice(undefined);
    setConnecting(app);
    try {
      const address = await connectWallet(app);
      await AsyncStorage.setItem(LAST_WALLET_KEY, app.id).catch(() => {});
      close({ status: 'connected', address, app });
    } catch (e) {
      const error = toWalletError(e, 'The wallet didn’t connect.');
      // Cancelled: the sheet already closed and sign-in says so.
      if (error.kind === 'cancelled') return;
      setConnecting(undefined);
      setNotice(connectNotice(error, app, () => void pick(app)));
    }
  };

  /** Only the Cancel button stops a connection in progress. */
  const cancel = () => {
    const app = connecting;
    cancelWalletRequest();
    close(app ? { status: 'cancelled', app } : { status: 'closed' });
  };

  // Back and a tap above the sheet close the list, but never a connection in
  // progress: coming back from the wallet with a back gesture would cancel it.
  const dismiss = () => {
    if (!connecting) close({ status: 'closed' });
  };

  // On this phone first: the default, then the last one used, then the rest.
  const rank = (app: WalletApp) =>
    app.id === defaultId ? 2 : app.id === lastUsed ? 1 : 0;
  const phoneApps = [...onPhone].sort((a, b) => rank(b) - rank(a));
  const more = WALLET_APPS.filter(
    app => !onPhone.some(found => found.id === app.id),
  );

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
      {app.id === defaultId ? (
        <Text style={[styles.tag, styles.tagDefault]}>Default</Text>
      ) : app.id === lastUsed ? (
        <Text style={styles.tag}>Last used</Text>
      ) : null}
      <ChevronRightIcon color={colors.dim} />
    </Pressable>
  );

  return (
    <Modal
      visible={open !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismiss}
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.handle} />
        {connecting ? (
          <Waiting app={connecting} stalled={!!stalled} onCancel={cancel} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[type.title, styles.title]}>Connect a wallet</Text>
              <Text style={[type.small, styles.muted]}>
                Pick the wallet you use. It opens so you can approve, then come
                back to Zeno.
              </Text>
            </View>
            {status === 'connected' && peer ? (
              <View style={styles.connected}>
                {peer.icon ? (
                  <Image source={{ uri: peer.icon }} style={styles.peerIcon} />
                ) : null}
                <Text style={styles.connectedText} numberOfLines={1}>
                  Connected:{' '}
                  <Text style={styles.connectedName}>{peer.name}</Text>
                </Text>
              </View>
            ) : null}
            {notice ? <Notice {...notice} /> : null}
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              bounces={false}
            >
              {phoneApps.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>On this phone</Text>
                  <View style={styles.group}>{phoneApps.map(row)}</View>
                </View>
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {phoneApps.length > 0 ? 'More wallets' : 'Wallets'}
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

/** A failed connection, told plainly, with what the user can do next. */
function connectNotice(
  error: ReturnType<typeof toWalletError>,
  app: WalletApp,
  retry: () => void,
): NoticeContent {
  const name = walletName(app);
  const tryAgain = { label: 'Try again', onPress: retry };
  switch (error.kind) {
    case 'rejected':
      return {
        tone: 'error',
        title: 'Connection declined',
        message: `You declined the connection in ${name}. Try again, or choose another wallet below.`,
        actions: [tryAgain],
      };
    case 'timeout':
      return {
        tone: 'error',
        title: `No response from ${name}`,
        message: 'The connection request timed out.',
        actions: [tryAgain],
      };
    case 'not-installed':
      return {
        tone: 'error',
        title: `${name} isn’t installed`,
        message: 'Install it, or choose another wallet below.',
        actions: [],
      };
    case 'offline':
      return {
        tone: 'error',
        title: 'You’re offline',
        message: 'Check your connection and try again.',
        actions: [tryAgain],
      };
    default:
      return {
        tone: 'error',
        title: `Couldn’t connect ${name}`,
        message: error.message,
        actions: [tryAgain],
      };
  }
}

/** The chosen wallet's logo in a spinning ring while the user approves. */
function Waiting({
  app,
  stalled,
  onCancel,
}: {
  app: WalletApp;
  stalled: boolean;
  onCancel: () => void;
}) {
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
      {stalled ? (
        // Came back twice without approving: the wallet was likely closed.
        <View style={styles.stalled}>
          <Notice
            tone="warning"
            title={`${name[0]!.toUpperCase()}${name.slice(1)} closed before you answered`}
            message={`The connection request is still waiting in ${name}.`}
            actions={
              app.scheme
                ? [
                    {
                      label: `Open ${name}`,
                      onPress: () => void openWalletApp(),
                    },
                  ]
                : []
            }
          />
        </View>
      ) : null}
      <View style={styles.waitingActions}>
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
  tagDefault: { color: colors.green, backgroundColor: colors.greenSoft },
  connected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
  },
  peerIcon: { width: 18, height: 18, borderRadius: 4 },
  connectedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  connectedName: { fontFamily: fonts.medium, color: colors.green },
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
  stalled: { alignSelf: 'stretch' },
  waitingActions: { alignSelf: 'stretch', gap: space.xs },
});
