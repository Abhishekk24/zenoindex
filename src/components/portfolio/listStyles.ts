/** Row styles shared by the Portfolio tabs (lines between rows, none after the last). */
import { StyleSheet } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';

export const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  fill: { flex: 1 },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  value: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    marginTop: 6,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
});
