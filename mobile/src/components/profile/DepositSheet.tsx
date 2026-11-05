/**
 * Deposit: the wallet's address as a QR code and text to copy, with the one
 * rule that loses money if broken — send only on the selected network.
 */
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { activeChain } from '../../config/chains';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { Button } from '../ui';

export function DepositSheet({
  address,
  visible,
  onClose,
}: {
  address: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <Text style={styles.title} accessibilityRole="header">
          Deposit
        </Text>
        <Text style={styles.body}>
          Scan or copy your wallet address to send funds to it.
        </Text>

        <View style={styles.qr} accessibilityLabel="Wallet address QR code">
          <QRCode value={address} size={196} backgroundColor="#ffffff" />
        </View>

        <Text style={styles.address} selectable>
          {address}
        </Text>
        <Button
          label={copied ? 'Copied' : 'Copy address'}
          variant="gold"
          onPress={copy}
        />

        <View style={styles.warning}>
          <Text style={styles.warningTitle}>
            Only send on {activeChain.name}
          </Text>
          <Text style={styles.warningText}>
            Send USDC (to invest) or the network’s native token (for network
            fees) on {activeChain.name} (chain ID {activeChain.id}) only. Tokens
            sent from another network, such as Ethereum or Base, or tokens Zeno
            doesn’t support, can be lost for good.
          </Text>
        </View>

        <Button label="Done" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  title: { fontFamily: fonts.medium, fontSize: 20, color: colors.text },
  body: { ...type.small, color: colors.muted },
  qr: {
    alignSelf: 'center',
    padding: space.md,
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
  },
  address: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
  },
  warning: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  warningTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.gold },
  warningText: { ...type.small, color: colors.text },
});
