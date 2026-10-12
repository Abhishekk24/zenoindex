/**
 * Reads a legal document (Terms of Service, Privacy Policy) inside the app.
 * Opens as a sheet over the screen it came from (terms, sign-in); Done closes it.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeIcon } from '../../components/icons';
import { isLegalDocId, LEGAL } from '../../content/legal';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const insets = useSafeAreaInsets();
  const document = isLegalDocId(doc) ? LEGAL[doc] : undefined;

  const close = () =>
    router.canGoBack() ? router.back() : router.replace('/');

  // iOS shows this as a page sheet below the status bar; Android full screen.
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {document?.title ?? 'Document'}
        </Text>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        {document ? (
          <>
            <Text style={styles.eyebrow}>Legal</Text>
            <Text style={styles.title} accessibilityRole="header">
              {document.title}
            </Text>
            <Text style={styles.updated}>
              {document.draft
                ? 'Not yet published'
                : `Last updated ${document.updated}`}
            </Text>

            {document.draft ? (
              <View style={styles.draft}>
                <NoticeIcon size={20} />
                <Text style={styles.draftText}>
                  Draft. Zeno&apos;s final text will replace this before launch.
                </Text>
              </View>
            ) : null}

            {document.sections.map((section, i) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.heading} accessibilityRole="header">
                  <Text style={styles.number}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  {'  '}
                  {section.heading}
                </Text>
                {section.body.map(paragraph => (
                  <Text key={paragraph} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.paragraph}>
            This document could not be found.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  barTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    maxWidth: '60%',
  },
  done: { position: 'absolute', right: space.lg, paddingVertical: space.sm },
  doneLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.gold },
  pressed: { opacity: 0.6 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl },
  eyebrow: { ...type.label, color: colors.gold },
  title: { ...type.display, color: colors.text, marginTop: space.sm },
  updated: { ...type.small, color: colors.dim, marginTop: space.xs },
  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  draftText: { ...type.small, color: colors.goldLight, flex: 1 },
  section: {
    marginTop: space.xl,
    paddingTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: space.md,
  },
  heading: { ...type.heading, color: colors.text },
  number: { fontFamily: fonts.mono, fontSize: 13, color: colors.gold },
  paragraph: { ...type.body, color: colors.textSecondary },
});
