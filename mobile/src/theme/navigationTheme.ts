/** Navigation (headers, tab bar) theme in the Zeno colours and font. */
import { DarkTheme, type Theme } from 'expo-router';

import { colors, fonts } from './tokens';

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.line,
    notification: colors.gold,
  },
  // Headers use `bold`, tab labels `medium`. The weight is in the family, so
  // fontWeight stays normal (see fonts in theme/tokens.ts).
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
    bold: { fontFamily: fonts.semibold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
  },
};
