/**
 * Something the user should know, told plainly: an optional title, the
 * message (wraps to any width) and what they can do next. Red edge for
 * something that went wrong, gold for a warning or "still waiting".
 * Used for wallet and trade problems and for sentence-length warnings that
 * don't fit a Badge.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme/tokens';

export type NoticeAction = { label: string; onPress: () => void };

export type NoticeContent = {
  tone: 'error' | 'warning';
  title?: string;
  message: string;
  actions?: NoticeAction[];
};

export function Notice({ tone, title, message, actions = [] }: NoticeContent) {
  return (
    <View
      style={[
        styles.box,
        { borderLeftColor: tone === 'error' ? colors.danger : colors.gold },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.action}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    backgroundColor: colors.notice,
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 6 },
  action: { paddingVertical: 4 },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
});
