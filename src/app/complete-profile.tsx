/** First sign-in: the personal details the account needs before investing. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Body,
  Button,
  Card,
  Display,
  Field,
  Label,
  Screen,
} from '../components/ui';
import * as api from '../lib/api';
import { colors, space, type } from '../theme/tokens';
import { useSession } from '../hooks/useSession';
import { useUser } from '../hooks/useUser';

export default function CompleteProfileScreen() {
  const user = useUser();
  const { setUser } = useSession();
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [country, setCountry] = useState(user.country ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const complete =
    firstName.trim() && lastName.trim() && /^[A-Za-z]{2}$/.test(country.trim());

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setUser(
        await api.completeProfile(user, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country: country.trim().toUpperCase(),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset>
      <View style={{ gap: space.sm, paddingTop: space.xl }}>
        <Label accent>Step 2 of 2</Label>
        <Display>Complete your profile</Display>
        <Body muted>
          Signed in as {user.email}. Your details stay with your account.
        </Body>
      </View>
      <Card banded>
        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
          textContentType="familyName"
        />
        <Field
          label="Country (2-letter code)"
          value={country}
          onChangeText={text => setCountry(text.slice(0, 2))}
          placeholder="GB"
          autoCapitalize="characters"
          maxLength={2}
        />
        {error ? (
          <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
        ) : null}
        <Button
          label="Save and continue"
          onPress={save}
          disabled={!complete}
          loading={busy}
        />
      </Card>
    </Screen>
  );
}
