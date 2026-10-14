/**
 * Edge-to-edge table of the manager screens (designs: Fee Schedule,
 * Corporate Actions): a shaded header row of small caps, then ruled rows.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';

export type Column = {
  label: string;
  /** Share of the row width. */
  flex: number;
  align?: 'left' | 'right';
};

export function ManagerTable({
  columns,
  rows,
}: {
  columns: Column[];
  /** One entry per row: a cell (text or element) per column. */
  rows: { key: string; cells: React.ReactNode[] }[];
}) {
  return (
    <View>
      <View style={[styles.row, styles.head]}>
        {columns.map(c => (
          <Text
            key={c.label}
            style={[
              styles.headText,
              { flex: c.flex, textAlign: c.align ?? 'left' },
            ]}
          >
            {c.label.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map(row => (
        <View key={row.key} style={[styles.row, styles.body]}>
          {row.cells.map((cell, i) => {
            const c = columns[i]!;
            const align = c.align === 'right' ? 'flex-end' : 'flex-start';
            return (
              <View key={c.label} style={{ flex: c.flex, alignItems: align }}>
                {typeof cell === 'string' ? (
                  <Text style={styles.cell} numberOfLines={1}>
                    {cell}
                  </Text>
                ) : (
                  cell
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 28,
  },
  head: { backgroundColor: colors.surface2, paddingVertical: 14 },
  headText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  body: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cell: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});
