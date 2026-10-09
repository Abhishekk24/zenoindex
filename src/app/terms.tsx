/** First sign-in: accept the Terms and Privacy Policy before anything else. */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Checkbox } from '../components/auth/Checkbox';
import { Body, Button, Card, Display, Label, Screen } from '../components/ui';
import { useSession } from '../hooks/useSession';
import { useUser } from '../hooks/useUser';
import * as api from '../lib/api';
import { colors, space, type } from '../theme/tokens';

export default function TermsScreen() {
  const user = useUser();
  const { setUser, signOut } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const accept = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setUser(await api.acceptTerms(user));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset>
      <View style={styles.intro}>
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
        <Checkbox checked={terms} onToggle={() => setTerms(v => !v)}>
          I have read and accept the Terms of Service.
        </Checkbox>
        <Checkbox checked={privacy} onToggle={() => setPrivacy(v => !v)}>
          I have read the Privacy Policy.
        </Checkbox>
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  intro: { gap: space.sm, paddingTop: space.xl },
  error: { ...type.small, color: colors.danger },
});
