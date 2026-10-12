/**
 * First sign-in: read and accept the Terms of Service and Privacy Policy
 * before anything else. Both open in the app (legal/[doc]) to read first.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Checkbox } from '../components/auth/Checkbox';
import {
  ChevronRightIcon,
  DocumentIcon,
  NoticeIcon,
} from '../components/icons';
import { Button } from '../components/ui';
import { LEGAL, type LegalDocId } from '../content/legal';
import { useSession } from '../hooks/useSession';
import { useUser } from '../hooks/useUser';
import * as api from '../lib/api';
import { colors, fonts, radius, space, type } from '../theme/tokens';

const DOCUMENTS: LegalDocId[] = ['terms', 'privacy'];

function openDocument(doc: LegalDocId) {
  router.push({ pathname: '/legal/[doc]', params: { doc } });
}

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xl },
        ]}
      >
        <View style={styles.steps} accessibilityLabel="Step 1 of 2">
          <View style={[styles.step, styles.stepActive]} />
          <View style={styles.step} />
        </View>
        <Text style={styles.eyebrow}>Step 1 of 2</Text>
        <Text style={styles.title} accessibilityRole="header">
          Before you continue
        </Text>
        <Text style={styles.lead}>
          Read Zeno&apos;s terms and privacy policy, then accept them to set up
          your account.
        </Text>

        <View style={styles.notice}>
          <NoticeIcon size={20} />
          <Text style={styles.noticeText}>
            Zeno is portfolio infrastructure software. Nothing in the app is
            investment, tax or legal advice. Tokenized equities and other
            tokenized assets carry risk, including{' '}
            <Text style={styles.noticeStrong}>
              total loss of the amount invested
            </Text>
            .
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Documents</Text>
        <View style={styles.documents}>
          {DOCUMENTS.map((doc, i) => (
            <Pressable
              key={doc}
              onPress={() => openDocument(doc)}
              accessibilityRole="button"
              accessibilityHint="Opens the document to read"
              style={({ pressed }) => [
                styles.document,
                i > 0 && styles.documentDivider,
                pressed && styles.documentPressed,
              ]}
            >
              <View style={styles.documentIcon}>
                <DocumentIcon color={colors.gold} />
              </View>
              <View style={styles.documentText}>
                <Text style={styles.documentTitle}>{LEGAL[doc].title}</Text>
                <Text style={styles.documentSummary}>{LEGAL[doc].summary}</Text>
              </View>
              <Text style={styles.read}>Read</Text>
              <ChevronRightIcon color={colors.gold} size={14} />
            </Pressable>
          ))}
        </View>

        <View style={styles.agreements}>
          <Checkbox checked={terms} onToggle={() => setTerms(v => !v)}>
            I have read and accept the{' '}
            <Text style={styles.link} onPress={() => openDocument('terms')}>
              Terms of Service
            </Text>
            .
          </Checkbox>
          <Checkbox checked={privacy} onToggle={() => setPrivacy(v => !v)}>
            I have read the{' '}
            <Text style={styles.link} onPress={() => openDocument('privacy')}>
              Privacy Policy
            </Text>
            .
          </Checkbox>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}
      >
        <Button
          label="Accept and continue"
          onPress={accept}
          disabled={!terms || !privacy}
          loading={busy}
        />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  steps: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  step: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surface3,
  },
  stepActive: { backgroundColor: colors.gold },
  eyebrow: { ...type.label, color: colors.gold },
  title: { ...type.display, color: colors.text, marginTop: space.sm },
  lead: { ...type.body, color: colors.muted, marginTop: space.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  noticeText: { ...type.small, color: colors.textSecondary, flex: 1 },
  noticeStrong: { fontFamily: fonts.semibold, color: colors.text },
  sectionLabel: {
    ...type.label,
    color: colors.muted,
    marginTop: space.xxl,
    marginBottom: space.md,
  },
  documents: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  documentDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineStrong,
  },
  documentPressed: { backgroundColor: colors.surface2 },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface3,
  },
  documentText: { flex: 1, gap: 2 },
  documentTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  documentSummary: { ...type.small, color: colors.dim },
  read: { fontFamily: fonts.medium, fontSize: 14, color: colors.gold },
  agreements: { marginTop: space.xl, gap: space.md },
  link: {
    fontFamily: fonts.medium,
    color: colors.gold,
    textDecorationLine: 'underline',
  },
  error: { ...type.small, color: colors.danger, marginTop: space.lg },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
