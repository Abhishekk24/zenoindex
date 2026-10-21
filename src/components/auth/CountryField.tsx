/**
 * Country picker for the profile step (design: "COUNTRY" / SELECT ▼): a field
 * in the sign-in input style that opens a sheet with a search box and every
 * country. The value is the ISO 3166-1 alpha-2 code the API stores.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COUNTRIES, countryName } from '../../content/countries';
import { colors, fonts } from '../../theme/tokens';
import { CARD_BG, INPUT_BG, INPUT_BORDER } from './palette';

export function CountryField({
  value,
  onChange,
}: {
  /** ISO code, e.g. "GB"; '' when none is chosen. */
  value: string;
  onChange: (code: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const name = countryName(value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    );
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Country: ${name ?? 'not chosen'}`}
        style={styles.field}
      >
        <Text
          style={[styles.value, !name && styles.placeholder]}
          numberOfLines={1}
        >
          {name ?? 'SELECT'}
        </Text>
        <Text style={styles.caret}>▼</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.sheetTitle}>Country</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.dim}
            selectionColor={colors.green}
            autoCorrect={false}
            style={styles.search}
            accessibilityLabel="Search countries"
          />
          <FlatList
            data={shown}
            keyExtractor={c => c.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.code);
                  close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: item.code === value }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text
                  style={[
                    styles.rowName,
                    item.code === value && styles.rowSelected,
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={styles.rowCode}>{item.code}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No country matches “{query}”.</Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

// Field values match the sign-in inputs (sign-in.tsx, EmailCodeStep).
const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
  },
  value: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  placeholder: { color: colors.muted, letterSpacing: 0.4 },
  caret: { fontSize: 10, color: colors.green },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.text },
  search: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: { opacity: 0.7 },
  rowName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  rowSelected: { color: colors.green, fontFamily: fonts.medium },
  rowCode: { fontFamily: fonts.mono, fontSize: 12, color: colors.dim },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingVertical: 16,
  },
});
