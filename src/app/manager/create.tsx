/**
 * Manager → Create basket (designs: Create steps 1–6). Opened from the Create
 * tab; full screen with ‹ back.
 *
 * 1 Identity · 2 Constituents · 3 Fees & Access · 4 Review ("Prep creation")
 * · 5 Deploy ("Submit") · 6 Configure (the created basket: seed it, open it in
 * Manager, or finish). The
 * network is Robinhood Chain, preset: there is nothing to choose. Continue checks the current step first.
 *
 * Assets come from GET /manager/create; Prep creation asks the API for the
 * factory's createVault transaction and Submit signs it with the manager's
 * wallet (src/manager/createBasket.ts). Only wallets the protocol admin
 * allowlisted as vault creators can create; others see why on step 1.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoIcon } from '../../components/icons';
import { BottomDrawer } from '../../components/manager/BottomDrawer';
import { ConstituentsStep } from '../../components/manager/create/ConstituentsStep';
import {
  CheckboxField,
  FIELD_BG,
  ReviewRow,
  SelectField,
  StepDots,
  TextField,
} from '../../components/manager/create/Fields';
import { BackButton } from '../../components/manager/ManagerBasketScreen';
import { alert, Stripes } from '../../components/ui';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useLoad } from '../../hooks/useLoad';
import { useSendDraft } from '../../hooks/useSendDraft';
import * as api from '../../lib/api';
import { createdVaultOf } from '../../lib/chain';
import { shortAddress } from '../../lib/format';
import { useWallet } from '../../lib/wallet';
import {
  ALLOCATION_STRATEGIES,
  CREATE_CHAINS,
  DIVIDEND_STRATEGIES,
  EMPTY_FORM,
  EXECUTION_MODES,
  REBALANCE_STRATEGIES,
  REBALANCE_TRIGGERS,
  STEPS,
  assetOf,
  labelOf,
  loadCreateOptions,
  pct,
  prepareCreation,
  providersOf,
  stepErrors,
  totalWeight,
  type CreateForm,
  type CreationDraft,
} from '../../manager/createBasket';
import { colors, fonts, radius, series, space } from '../../theme/tokens';

/**
 * Picks the basket image from the photo library (square crop). Uses the
 * system picker, so Android needs no permission; iOS asks once.
 */
async function pickImage(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  return result.canceled ? undefined : result.assets[0]?.uri;
}

const REVIEW = 3;
const DEPLOY = 4;
const CONFIGURE = 5;

/** The API reads baskets through a short cache, so a just-created one can take a few seconds to appear. */
async function waitForDashboard(id: string, tries = 8) {
  for (let i = 0; ; i++) {
    try {
      return await api.getManagerDashboard(id);
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await new Promise(r => setTimeout(r, 2500));
    }
  }
}

/** 0x8f…0000, as the Deploy design shows calldata. */
const shortHex = (hex: string) =>
  hex.length > 12 ? `${hex.slice(0, 4)}…${hex.slice(-4)}` : hex;

export default function CreateBasketScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Every step opens at its top: the steps share one scroll view, and its
  // Continue / Previous buttons sit at the bottom, so a new step would
  // otherwise open scrolled down past its first fields.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const [reached, setReached] = useState(0);
  // Steps where Continue was pressed: only then show their errors.
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<CreationDraft>();
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** The created basket's address (Configure step). */
  const [created, setCreated] = useState<string>();
  const [seeding, setSeeding] = useState<'' | 'wait' | 'send'>('');
  const [seeded, setSeeded] = useState(false);
  const { address } = useWallet();
  const sendDraft = useSendDraft();
  const {
    data: options,
    error: optionsError,
    loading: optionsLoading,
    reload: reloadOptions,
  } = useLoad(loadCreateOptions, 'create-options');
  const assets = options?.assets ?? [];

  const update = (patch: Partial<CreateForm>) => {
    setForm(current => ({ ...current, ...patch }));
    // Changing anything before Deploy makes the prepared draft stale.
    setDraft(undefined);
  };

  const errors = useMemo(() => stepErrors(form, step), [form, step]);
  const valid = Object.keys(errors).length === 0;
  const shown = checked.has(step) ? errors : {};

  const go = (next: number) => {
    setStep(next);
    setReached(r => Math.max(r, next));
  };

  const next = () => {
    if (!valid) {
      setChecked(current => new Set(current).add(step));
      // Up to the fields, where their error messages now show.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    go(step + 1);
  };

  const prep = async () => {
    setPreparing(true);
    try {
      setDraft(await prepareCreation(form));
      go(DEPLOY);
    } catch (e) {
      alert('Could not prepare', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      const op = await sendDraft(draft.tx);
      const id = op.txHash
        ? await createdVaultOf(draft.tx.transaction.chainId, op.txHash)
        : undefined;
      if (!id) {
        alert(
          'Basket created',
          'Seed it from Rebalance (genesis, 1 USDG) before anyone can invest.',
        );
        router.replace('/baskets');
        return;
      }
      setCreated(id);
      go(CONFIGURE);
    } catch (e) {
      alert(
        'Create failed',
        e instanceof Error ? e.message : 'Transaction failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Genesis: the 1 USDG seed that opens the basket to investors. */
  const seed = async () => {
    if (!created) return;
    setSeeding('wait');
    try {
      const { dtf } = await waitForDashboard(created);
      setSeeding('send');
      await sendDraft(
        await api.prepareManagerTx(dtf, {
          name: 'genesis',
          body: { baselineSharePrice: '1' },
        }),
      );
      setSeeded(true);
    } catch (e) {
      alert(
        'Could not seed',
        e instanceof Error ? e.message : 'Transaction failed.',
      );
    } finally {
      setSeeding('');
    }
  };

  const chain = CREATE_CHAINS.find(c => c.value === form.chain);
  const providers = providersOf(form.chain);
  const providerLabel = labelOf(providers, form.provider);
  const base = assetOf(form.baseAssetId, assets);
  const baseLabel = base ? `${base.name} (${base.symbol})` : '—';

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.lg,
            paddingBottom: keyboardHeight + space.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton />
        <Text style={styles.title} accessibilityRole="header">
          Create
        </Text>

        <View style={styles.dots}>
          <StepDots
            count={STEPS.length}
            current={step}
            reached={reached}
            onPress={setStep}
          />
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stripes} pointerEvents="none">
            <Stripes height={52} stripe={2} gap={7} opacity={0.16} />
          </View>
          <Text style={styles.stepTitle}>{STEPS[step]}</Text>
        </View>

        <View style={styles.body}>
          {step === 0 && (
            <View style={styles.fields}>
              <TextField
                label="Basket Name"
                value={form.name}
                onChangeText={name => update({ name })}
                placeholder="Enter name"
                error={shown.name}
              />
              <TextField
                label="Symbol"
                value={form.symbol}
                onChangeText={symbol =>
                  update({ symbol: symbol.toUpperCase() })
                }
                placeholder="Enter symbol"
                autoCapitalize="characters"
                maxLength={11}
                error={shown.symbol}
              />
              <View style={styles.imageField}>
                <Text style={styles.label}>DTF Image</Text>
                <Pressable
                  onPress={() =>
                    pickImage()
                      .then(uri => uri && update({ imageUri: uri }))
                      .catch(() =>
                        alert(
                          'Couldn’t open your photos',
                          'Check Zeno’s photo access in Settings and try again.',
                        ),
                      )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    form.imageUri
                      ? 'Change basket image'
                      : 'Choose basket image'
                  }
                  style={styles.imageBox}
                >
                  {form.imageUri ? (
                    <View style={styles.imagePicked}>
                      <Image
                        source={{ uri: form.imageUri }}
                        style={styles.imageThumb}
                        accessibilityIgnoresInvertColors
                      />
                      <Text style={styles.imageText}>Change image</Text>
                    </View>
                  ) : (
                    <Text style={styles.imageText}>Choose File</Text>
                  )}
                </Pressable>
              </View>
              <TextField
                label="Compliance Scope"
                optional
                value={form.complianceScope}
                onChangeText={complianceScope => update({ complianceScope })}
                placeholder="Enter name"
              />
            </View>
          )}

          {step === 1 && (
            <ConstituentsStep
              assets={assets}
              loading={optionsLoading}
              loadError={optionsError}
              onRetry={reloadOptions}
              form={form}
              update={update}
              providerLabel={providerLabel === '—' ? 'Provider' : providerLabel}
              baseError={shown.baseAssetId}
            />
          )}

          {step === 2 && (
            <View style={styles.fields}>
              <TextField
                label="Entry fee (%)"
                value={form.entryFee}
                onChangeText={entryFee => update({ entryFee })}
                placeholder="e.g. 0.50"
                keyboardType="decimal-pad"
                error={shown.entryFee}
              />
              <TextField
                label="Exit fee (%)"
                value={form.exitFee}
                onChangeText={exitFee => update({ exitFee })}
                placeholder="e.g. 0.50"
                keyboardType="decimal-pad"
                error={shown.exitFee}
              />
              <TextField
                label={`Minimum investment amount (${baseLabel})`}
                value={form.minInvestment}
                onChangeText={minInvestment => update({ minInvestment })}
                placeholder="e.g. 1.50"
                keyboardType="decimal-pad"
                error={shown.minInvestment}
              />
              <SelectField
                label="Rebalance strategy"
                value={form.rebalanceStrategy}
                options={REBALANCE_STRATEGIES}
                onChange={rebalanceStrategy => update({ rebalanceStrategy })}
              />
              <TextField
                label="Fee recipient (optional)"
                value={form.feeRecipient}
                onChangeText={feeRecipient => update({ feeRecipient })}
                placeholder="Defaults to the manager wallet"
                autoCapitalize="none"
                autoCorrect={false}
                error={shown.feeRecipient}
              />
              <SelectField
                label="Allocation strategy"
                value={form.allocationStrategy}
                options={ALLOCATION_STRATEGIES}
                onChange={allocationStrategy => update({ allocationStrategy })}
              />
              <SelectField
                label="Execution Mode"
                value={form.executionMode}
                options={EXECUTION_MODES}
                onChange={executionMode => update({ executionMode })}
              />
              <SelectField
                label="Rebalance trigger"
                value={form.rebalanceTrigger}
                options={REBALANCE_TRIGGERS}
                onChange={rebalanceTrigger => update({ rebalanceTrigger })}
              />
              <SelectField
                label="Dividend Strategy"
                value={form.dividendStrategy}
                options={DIVIDEND_STRATEGIES}
                onChange={dividendStrategy => update({ dividendStrategy })}
              />
              <CheckboxField
                label="Enable Corporate Action"
                checked={form.corporateActions}
                onToggle={() =>
                  update({ corporateActions: !form.corporateActions })
                }
              />
            </View>
          )}

          {step === REVIEW && (
            <View style={styles.review}>
              <ReviewRow label="Name" value={form.name} />
              <ReviewRow label="Symbol" value={form.symbol} />
              <ReviewRow label="Chain" value={chain?.label ?? '—'} />
              <ReviewRow label="Provider" value={providerLabel} />
              <ReviewRow label="Base asset" value={baseLabel} />
              <ReviewRow
                label="Manager"
                value={address ? `You · ${shortAddress(address)}` : '—'}
              />
              <ReviewRow label="Entry fee" value={pct(form.entryFee)} />
              <ReviewRow label="Exit fee" value={pct(form.exitFee)} />
              <ReviewRow
                label="Minimum investment"
                value={
                  form.minInvestment.trim()
                    ? `${form.minInvestment} ${base?.symbol ?? ''}`.trim()
                    : '—'
                }
              />
              <ReviewRow
                label="Rebalance strategy"
                value={labelOf(REBALANCE_STRATEGIES, form.rebalanceStrategy)}
              />
              <ReviewRow
                label="Corporate actions"
                value={form.corporateActions ? 'Enabled' : 'Disabled'}
              />
              <ReviewRow
                label="Dividend strategy"
                value={labelOf(DIVIDEND_STRATEGIES, form.dividendStrategy)}
              />
              <View style={styles.policy}>
                <Text style={styles.policyTitle}>REBALANCE POLICY</Text>
                {[
                  [
                    'Strategy',
                    labelOf(ALLOCATION_STRATEGIES, form.allocationStrategy),
                  ],
                  [
                    'Trigger',
                    labelOf(REBALANCE_TRIGGERS, form.rebalanceTrigger),
                  ],
                  ['Execution', labelOf(EXECUTION_MODES, form.executionMode)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.policyRow}>
                    <Text style={styles.policyLabel}>{label}</Text>
                    <Text style={styles.policyValue}>
                      {value!.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === DEPLOY && (
            <View style={styles.review}>
              {draft ? (
                <>
                  <ReviewRow label="Operation" value={draft.operation} />
                  <ReviewRow label="Status" value={draft.status} />
                  <ReviewRow label="To" value={shortAddress(draft.to)} />
                  <ReviewRow label="Chain ID" value={String(draft.chainId)} />
                  <ReviewRow
                    label="Calldata"
                    value={shortHex(draft.calldata)}
                  />
                </>
              ) : (
                <Text style={styles.soon}>
                  Go back to Review and tap Prep creation to prepare the
                  transaction.
                </Text>
              )}
            </View>
          )}

          {step === CONFIGURE &&
            (created ? (
              <View style={styles.review}>
                <ReviewRow label="Status" value="Created on-chain" />
                <ReviewRow label="Basket" value={shortAddress(created)} />
                <ReviewRow label="Name" value={form.name} />
                <ReviewRow label="Symbol" value={form.symbol} />
                <ReviewRow
                  label="Seed (genesis)"
                  value={seeded ? 'Done · open to investors' : 'Not yet'}
                />
                <View style={styles.configure}>
                  <Text style={styles.noteText}>
                    {seeded
                      ? 'Investors can buy in now. Deposits wait in each asset until you invest them from Rebalance.'
                      : 'Nobody can invest until the basket is seeded: a 1 USDG genesis deposit from your wallet sets the starting share price at 1 USDG.'}
                  </Text>
                  {!seeded ? (
                    <Pressable
                      onPress={seed}
                      disabled={seeding !== ''}
                      accessibilityRole="button"
                      accessibilityState={{ busy: seeding !== '' }}
                      style={({ pressed }) => [
                        styles.submit,
                        styles.wide,
                        seeding !== '' && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.submitText}>
                        {seeding === 'wait'
                          ? 'Finding your basket…'
                          : seeding === 'send'
                            ? 'Waiting for confirmation…'
                            : 'Seed the basket (1 USDG)'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() =>
                      router.replace({
                        pathname: '/manager/[id]/rebalance',
                        params: { id: created },
                      })
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primary,
                      styles.wide,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>Open in Manager</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.replace('/baskets')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.previous,
                      styles.wide,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.previousText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.soon}>
                Submit the prepared transaction on Deploy first.
              </Text>
            ))}
        </View>

        {step === 0 && (optionsError || (options && !options.canCreate)) ? (
          <View style={styles.note}>
            <InfoIcon color={colors.gold} size={18} />
            <Text style={styles.noteText}>
              {optionsError
                ? optionsError
                : `Your wallet${address ? ` ${shortAddress(address)}` : ''} isn't approved to create baskets yet. Send its address (Profile → Wallets) to the Zeno team to get it allowlisted.`}
            </Text>
          </View>
        ) : null}

        {step === 0 ? (
          <View style={styles.note}>
            <InfoIcon color={colors.muted} size={18} />
            <Text style={styles.noteText}>
              Nothing touches chain until you confirm and sign the prepared
              transaction.
            </Text>
          </View>
        ) : null}

        <View style={styles.nav}>
          <Pressable
            onPress={() => setStep(s => s - 1)}
            // Once created there is nothing to go back to: Deploy would re-submit.
            disabled={step === 0 || !!created}
            accessibilityRole="button"
            accessibilityState={{ disabled: step === 0 || !!created }}
            style={({ pressed }) => [
              styles.previous,
              (step === 0 || !!created) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.previousText}>Previous</Text>
          </Pressable>

          {step === REVIEW ? (
            <Pressable
              onPress={prep}
              disabled={preparing}
              accessibilityRole="button"
              accessibilityState={{ busy: preparing }}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>
                {preparing ? 'Preparing…' : 'Prep creation'}
              </Text>
            </Pressable>
          ) : step === DEPLOY ? (
            <Pressable
              onPress={submit}
              disabled={!draft || submitting}
              accessibilityRole="button"
              accessibilityState={{ busy: submitting }}
              style={({ pressed }) => [
                styles.submit,
                (!draft || submitting) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.submitText}>
                {submitting ? 'Waiting for confirmation…' : 'Submit'}
              </Text>
            </Pressable>
          ) : step < STEPS.length - 1 ? (
            <Pressable
              onPress={next}
              // The design greys Continue out on Constituents until it's valid.
              disabled={step === 1 && !valid}
              accessibilityRole="button"
              accessibilityState={{ disabled: step === 1 && !valid }}
              style={({ pressed }) => [
                styles.continue,
                step === 1 && !valid && styles.continueOff,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.continueText,
                  step === 1 && !valid && styles.continueTextOff,
                ]}
              >
                Continue
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <BottomDrawer label="Preview basket" title="Preview basket">
        <Preview form={form} />
      </BottomDrawer>
    </View>
  );
}

/** The basket as it stands (Preview basket sheet). */
function Preview({ form }: { form: CreateForm }) {
  const total = totalWeight(form);
  const weighted = form.constituents.filter(c => Number(c.weight) > 0);
  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        {form.imageUri ? (
          <Image
            source={{ uri: form.imageUri }}
            style={styles.previewImage}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text style={styles.previewName}>
          {form.name.trim() || 'Basket name'}
        </Text>
        <View style={styles.draftBadge}>
          <Text style={styles.draftText}>Draft</Text>
        </View>
      </View>
      <Text style={styles.previewMeta}>
        {form.symbol.trim() || 'SYMBOL'} · you
      </Text>
      {weighted.length > 0 ? (
        <View style={styles.bar}>
          {weighted.map((c, i) => (
            <View
              key={c.assetId}
              style={{
                flex: Number(c.weight),
                backgroundColor: series[i % series.length],
              }}
            />
          ))}
          {total < 100 ? (
            <View style={[styles.unallocated, { flex: 100 - total }]} />
          ) : null}
        </View>
      ) : null}
      <Text style={styles.previewEmpty}>
        {form.constituents.length === 0
          ? 'No constituents yet. They appear here as you add them.'
          : `${form.constituents.length} constituent${
              form.constituents.length === 1 ? '' : 's'
            } · ${Math.max(0, 100 - total).toFixed(2)}% unallocated`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: space.md },
  title: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: space.md,
    paddingHorizontal: space.md,
  },
  dots: { marginTop: space.lg, paddingHorizontal: space.sm },
  stepCard: {
    marginTop: space.lg,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
  },
  stripes: { position: 'absolute', top: 0, right: 0, width: '55%', height: 52 },
  stepTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  body: { flexGrow: 1, marginTop: space.xl },
  fields: { gap: space.xl, paddingHorizontal: space.xs },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  imageField: { gap: 10 },
  imageBox: {
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineControl,
    backgroundColor: FIELD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePicked: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  imageThumb: { width: 56, height: 56, borderRadius: 28 },
  previewImage: { width: 32, height: 32, borderRadius: 16 },
  imageText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  review: { marginHorizontal: -space.md },
  policy: {
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  policyTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.gold,
    paddingHorizontal: space.xl,
    marginBottom: space.sm,
  },
  policyRow: {
    gap: 8,
    paddingHorizontal: space.xl,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  policyLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  policyValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  soon: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: space.lg,
  },
  configure: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  wide: { alignItems: 'center' },
  note: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginTop: space.xl,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xl,
    paddingHorizontal: space.xs,
  },
  previous: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  previousText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  continue: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  continueOff: { backgroundColor: '#6f7471' },
  continueText: { fontFamily: fonts.regular, fontSize: 14, color: '#050706' },
  continueTextOff: { color: colors.textSecondary },
  primary: {
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryText: { fontFamily: fonts.medium, fontSize: 16, color: '#050706' },
  submit: {
    borderRadius: 8,
    backgroundColor: '#1d4a35',
    paddingHorizontal: 26,
    paddingVertical: 11,
  },
  submitText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  preview: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    padding: space.lg,
    gap: 6,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  previewName: { fontFamily: fonts.medium, fontSize: 17, color: colors.text },
  draftBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  draftText: { fontFamily: fonts.medium, fontSize: 11, color: colors.gold },
  previewMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
    marginTop: space.md,
  },
  unallocated: { backgroundColor: colors.surface3 },
  previewEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.dim,
    marginTop: space.sm,
  },
});
