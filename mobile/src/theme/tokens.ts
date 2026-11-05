/**
 * Zeno black-and-gold theme, from the web redesign
 * (programmable-dtf-infra/apps/dtf-app/src/zeno-theme.css).
 */
import { Platform } from 'react-native';

export const colors = {
  bg: '#050706',
  surface: '#0c0f0e',
  surface2: '#141817',
  surface3: '#1b201e',
  /** Notices (ui/Notice): a dark green panel, like the sign-in inputs. */
  notice: '#08150f',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.16)',
  lineControl: 'rgba(255, 255, 255, 0.22)',
  text: '#f4f5f2',
  textSecondary: '#d7dbd8',
  muted: '#a3aaa5',
  dim: '#7d847f',
  gold: '#cdb679',
  goldStrong: '#b59c5c',
  goldLight: '#e3cf98',
  goldSoft: 'rgba(205, 182, 121, 0.12)',
  goldLine: 'rgba(205, 182, 121, 0.32)',
  green: '#5cc796',
  greenSoft: 'rgba(92, 199, 150, 0.1)',
  greenLine: 'rgba(92, 199, 150, 0.35)',
  primaryGreen: '#2f7d58',
  danger: '#f0a0a0',
  dangerSoft: 'rgba(240, 160, 160, 0.1)',
  /** Stronger red from the new designs: losses, ▼ changes, Sign out. */
  red: '#e5484d',
  onGold: '#17140c',
} as const;

/** Series colours for allocation charts, gold first. */
export const series = [
  '#cdb679',
  '#5cc796',
  '#8fb3d9',
  '#d98f8f',
  '#b39ddb',
  '#e3cf98',
  '#7d847f',
] as const;

export const radius = { sm: 8, md: 12, lg: 14, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * The tab bar floats over the tab screens (translucent, blurred), so their
 * content adds this much bottom space plus the safe-area inset.
 */
export const tabBarHeight = 64;

/**
 * App font: Space Grotesk (@expo-google-fonts/space-grotesk, loaded in
 * src/app/_layout.tsx under these family names). Each weight is its own
 * family: pick the weight with the family and never add `fontWeight` or
 * `fontStyle`, or Android fakes a bold or slant on top of the real face.
 */
export const fonts = {
  light: 'SpaceGrotesk-Light',
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  semibold: 'SpaceGrotesk-SemiBold',
  bold: 'SpaceGrotesk-Bold',
  /** Display serif (Instrument Serif), as on the website: titles, names, hero lines. */
  serif: 'InstrumentSerif-Regular',
  serifItalic: 'InstrumentSerif-Italic',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38 },
  title: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 25 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  figure: { fontFamily: fonts.mono, fontSize: 20, lineHeight: 26 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
} as const;
