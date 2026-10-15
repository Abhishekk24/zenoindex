/**
 * Form controls of the Create basket flow (designs: Create steps 1–6):
 * labelled text box, dropdown (opens a picker sheet), checkbox, step dots and
 * review rows.
 */
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Option } from '../../../manager/createBasket';
import { colors, fonts, space } from '../../../theme/tokens';
import { ChevronUpIcon } from '../../icons';

export const FIELD_BG = '#141716';

function Label({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <Text style={styles.label}>
      {text}
      {optional ? <Text style={styles.optional}> [Optional]</Text> : null}
    </Text>
  );
}

function ErrorText({ error }: { error?: string }) {
  return error ? <Text style={styles.error}>{error}</Text> : null;
}

export function TextField({
  label,
  optional,
  error,
  ...input
}: TextInputProps & { label: string; optional?: boolean; error?: string }) {
  return (
    <View style={styles.field}>
      <Label text={label} optional={optional} />
      <TextInput
        placeholderTextColor={colors.dim}
        selectionColor={colors.gold}
        style={[styles.box, styles.input, error && styles.boxError]}
        accessibilityLabel={label}
        {...input}
      />
      <ErrorText error={error} />
    </View>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  error,
  chevron = true,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  chevron?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.field}>
      <Label text={label} />
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not chosen'}`}
        style={[styles.box, styles.select, error && styles.boxError]}
      >
        <Text style={[styles.selectText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        {chevron ? (
          <View style={styles.down}>
            <ChevronUpIcon color={colors.text} size={18} />
          </View>
        ) : null}
      </Pressable>
      <ErrorText error={error} />

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
        >
          <Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView style={styles.sheetList}>
            {options.length === 0 ? (
              <Text style={styles.empty}>Nothing to choose yet.</Text>
            ) : (
              options.map(o => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o.value === value }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      o.value === value && styles.optionSelected,
                    ]}
                  >
                    {o.label}
                  </Text>
                  {o.value === value ? (
                    <Text style={styles.check}>✓</Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function CheckboxField({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * 1 – 2 – 3 … dots: done steps green, the current one white. Only steps
 * already reached can be tapped.
 */
export function StepDots({
  count,
  current,
  reached,
  onPress,
}: {
  count: number;
  current: number;
  /** Highest step index the user has reached. */
  reached: number;
  onPress: (step: number) => void;
}) {
  return (
    <View style={styles.dots} accessibilityRole="tablist">
      <View style={styles.dotsLine} />
      {Array.from({ length: count }, (_, i) => {
        const done = i < current || (i <= reached && i !== current);
        const active = i === current;
        return (
          <Pressable
            key={i}
            onPress={() => onPress(i)}
            disabled={i > reached}
            accessibilityRole="tab"
            accessibilityLabel={`Step ${i + 1}`}
            accessibilityState={{ selected: active, disabled: i > reached }}
            hitSlop={4}
            style={[
              styles.dot,
              done && styles.dotDone,
              active && styles.dotActive,
            ]}
          >
            <Text
              style={[
                styles.dotText,
                done && styles.dotTextDone,
                active && styles.dotTextActive,
              ]}
            >
              {i + 1}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  field: { gap: 10 },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  optional: { color: colors.green },
  box: {
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  boxError: { borderColor: colors.danger },
  input: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  placeholder: { fontFamily: fonts.regular, color: colors.textSecondary },
  down: { transform: [{ rotate: '180deg' }] },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.lineStrong,
    paddingTop: space.xl,
  },
  sheetTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.muted,
    textTransform: 'uppercase',
    paddingHorizontal: space.xl,
    marginBottom: space.sm,
  },
  sheetList: { flexGrow: 0 },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pressed: { backgroundColor: colors.surface3 },
  optionText: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  optionSelected: { fontFamily: fonts.medium, color: colors.gold },
  check: { fontFamily: fonts.medium, fontSize: 16, color: colors.gold },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.lineControl,
    backgroundColor: FIELD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.green,
  },
  checkMark: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  checkLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotsLine: {
    position: 'absolute',
    left: DOT / 2,
    right: DOT / 2,
    height: 1,
    backgroundColor: colors.lineStrong,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface3,
  },
  dotDone: { backgroundColor: '#1d4a35' },
  dotActive: { backgroundColor: '#ffffff' },
  dotText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dotTextDone: { color: colors.green },
  dotTextActive: { color: '#050706' },
  reviewRow: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reviewLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  reviewValue: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});
