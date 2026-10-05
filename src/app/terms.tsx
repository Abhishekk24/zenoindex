/** First sign-in: accept the Terms and Privacy Policy before anything else. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Display, Label, Screen } from '../components/ui';
import * as api from '../lib/api';
import { useSession, useUser } from '../lib/session';
import { colors, fonts, radius, space, type } from '../theme/tokens';

function Check({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.check}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text style={[type.body, styles.checkLabel]}>{children}</Text>
    </Pressable>
  );
}

export default function TermsScreen() {
  const user = useUser();
  const { setUser, signOut } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      setUser(await api.acceptTerms(user));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset>
      <View style={{ gap: space.sm, paddingTop: space.xl }}>
        <Label accent>Step 1 of 2</Label>
        <Display>Before you continue</Display>
        <Body muted>
          Zeno is portfolio infrastructure software. Nothing in the app is
          investment, tax or legal advice. Tokenized equities and other
          tokenized assets carry risk, including total loss of the amount
          invested.
        </Body>
      </View>
      <Card banded>
        <Check checked={terms} onToggle={() => setTerms(v => !v)}>
          I have read and accept the Terms of Service.
        </Check>
        <Check checked={privacy} onToggle={() => setPrivacy(v => !v)}>
          I have read the Privacy Policy.
        </Check>
        <Button
          label="Accept and continue"
          onPress={accept}
          disabled={!terms || !privacy}
          loading={busy}
        />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tick: { color: colors.onGold, fontFamily: fonts.bold },
  checkLabel: { color: colors.textSecondary, flex: 1 },
  check: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: radius.sm / 2,
    borderWidth: 1,
    borderColor: colors.lineControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
});
