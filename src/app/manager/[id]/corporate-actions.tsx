/**
 * Manager → basket → Corporate actions (design): actions grouped by type in
 * collapsible sections, from the basket's detail (GET /dtfs/:id). The API's
 * corporate-actions read model is still "unavailable", so this is empty until
 * the indexer lands.
 */
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronUpIcon } from '../../../components/icons';
import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { ManagerTable } from '../../../components/manager/ManagerTable';
import { Empty } from '../../../components/ui';
import { useManagedBasket } from '../../../hooks/useManagedBasket';
import { formatDate } from '../../../lib/format';
import type { CorporateAction } from '../../../lib/types';
import { colors, fonts, space } from '../../../theme/tokens';

const INFO =
  'Dividends, splits and eligibility updates recorded against your baskets.';

type CorporateActionStatus = 'announced' | 'effective';

type Row = {
  id: string;
  type: string;
  /** e.g. "0.01"; null when the action has no amount. */
  amount: string | null;
  recordDate: string;
  status: CorporateActionStatus;
};

/** "cash_dividend" → "Cash Dividend". */
function typeLabel(actionType: string): string {
  return actionType
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function toRow(action: CorporateAction): Row | null {
  if (action.status === 'cancelled') return null;
  const payload = (action.payload ?? {}) as { amount?: unknown };
  return {
    id: action.id,
    type: typeLabel(action.actionType),
    amount: payload.amount != null ? String(payload.amount) : null,
    recordDate: action.effectiveAt,
    status: action.status,
  };
}

function StatusPill({ status }: { status: CorporateActionStatus }) {
  const effective = status === 'effective';
  return (
    <View style={[styles.pill, effective && styles.pillEffective]}>
      <Text style={[styles.pillText, effective && styles.pillTextEffective]}>
        {status}
      </Text>
    </View>
  );
}

export default function ManagerCorporateActionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: dtf, loading, error, reload } = useManagedBasket(id);

  const groups = useMemo(() => {
    const byType = new Map<string, Row[]>();
    for (const action of dtf?.corporateActions ?? []) {
      const row = toRow(action);
      if (row) byType.set(row.type, [...(byType.get(row.type) ?? []), row]);
    }
    return [...byType.entries()];
  }, [dtf]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allCollapsed = collapsed.size === groups.length;
  const toggle = (type: string) =>
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Corporate Actions"
      info={INFO}
      right={
        <Pressable
          onPress={() =>
            setCollapsed(
              allCollapsed ? new Set() : new Set(groups.map(g => g[0])),
            )
          }
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.collapseAll}>
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Text>
        </Pressable>
      }
    >
      <View style={styles.groups}>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Empty
              title="No corporate actions"
              body="Dividends, splits and eligibility updates for this basket appear here."
            />
          </View>
        ) : null}
        {groups.map(([type, actions]) => {
          const open = !collapsed.has(type);
          return (
            <View key={type}>
              <Pressable
                onPress={() => toggle(type)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={styles.groupHead}
              >
                <Text style={styles.groupTitle}>{type}</Text>
                <View style={!open && styles.flip}>
                  <ChevronUpIcon color={colors.text} size={20} />
                </View>
              </Pressable>
              {open ? (
                <ManagerTable
                  columns={[
                    { label: 'Amount', flex: 1 },
                    { label: 'Record date', flex: 1.3, align: 'right' },
                    { label: 'Status', flex: 1, align: 'right' },
                  ]}
                  rows={actions.map(action => ({
                    key: action.id,
                    cells: [
                      action.amount ?? '-',
                      formatDate(action.recordDate),
                      <StatusPill key="status" status={action.status} />,
                    ],
                  }))}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </ManagerBasketScreen>
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: space.md },
  collapseAll: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  groups: { gap: space.xxl },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.surface3,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  groupTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  flip: { transform: [{ rotate: '180deg' }] },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  pillEffective: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenLine,
  },
  pillText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  pillTextEffective: { color: colors.green },
});
