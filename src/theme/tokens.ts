/**
 * Design tokens — the single source of truth for color, radius, and type.
 * No component should hardcode a color, radius, or font; pull from here.
 */

import type { ViewStyle } from 'react-native';

/** Pressed-state feedback, shared by every tappable surface so the whole app
    reacts to touch the same way (use inside a Pressable style callback). */
export const press: Record<'button' | 'chip' | 'row', ViewStyle> = {
  // Gradient CTAs: a subtle sink, like the prototype's button:active.
  button: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  // Pills, FABs, icon buttons: small targets need a clearer shrink to read.
  chip: { transform: [{ scale: 0.94 }], opacity: 0.85 },
  // Full-width cards & list rows: dim only — scaling a wide row looks warped.
  row: { opacity: 0.65 },
};

export const colors = {
  // Surfaces
  canvas: '#DEDBEF',
  phoneBg: '#ECEAF8',

  // Screen gradients (top -> bottom)
  splashGradient: ['#ECEAF8', '#E7E4F5'] as const,
  panelGradient: ['#F2F1FB', '#E9E6F6'] as const, // permission / denied
  statsGradient: ['#F2F1FB', '#EAE7F6'] as const,

  // Text
  ink: '#2C2F60', // primary / display
  inkSoft: '#7E81A8', // secondary body
  inkMuted: '#9A9CC0', // tertiary / links rest
  label: '#8A8DB4', // small caps labels

  // Brand blue
  blue: '#6E91EE',
  blueDeep: '#5C7CE0',
  blueSoft: '#7B9CF0',
  blueLink: '#5C7CE0',
  primaryButton: ['#88A5F4', '#6E91EE'] as const,

  // Privacy chip
  chipBg: 'rgba(255,255,255,0.7)',
  chipBorder: '#DAD8EE',
  chipText: '#5C7CE0',

  // Toast (success)
  toastGradient: ['#7FD4B4', '#5FC39C'] as const,

  // Sun / warm accents
  sun: ['#F8C84E', '#F4B73D'] as const,

  // Fog cloud cell
  fogGradient: ['#F6F5FC', '#E2E0F2'] as const,

  // Map base
  white: '#FFFFFF',
  land: '#ECE7DB',
  water: ['#8FC3E6', '#B4D8F0', '#97C6E8'] as const,
  park: ['#B7E2A8', '#CDE9C2', '#C6E6BB'] as const,
  gridLine: 'rgba(255,255,255,0.6)',

  // Location dot
  dotPulse: '#7B9CF0',
  dotCore: '#5C7CE0',

  // Progress hex
  hexFill: '#7B9CF0',
  hexTrack: '#E2E0F0',
  hexTrackStrong: '#E4E2F2',

  // Stats card
  cardDivider: '#F0EFF8',

  // POI pin palette
  poi: {
    orange: '#F2A65A',
    green: '#6FBF73',
    blue: '#5C8FE0',
    purple: '#9E91E0',
  },

  // Stats rows (tint bg / accent fg)
  statTints: [
    { bg: '#E8EFFD', fg: '#7B9CF0' },
    { bg: '#E6F6EE', fg: '#5FC39C' },
    { bg: '#F1ECFB', fg: '#9E91E0' },
    { bg: '#FBF0E0', fg: '#F4B73D' },
  ] as const,
} as const;

export const fonts = {
  // Fredoka — display, headings, buttons, numerals
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  displayBold: 'Fredoka_700Bold',
  // Nunito — body copy
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtra: 'Nunito_800ExtraBold',
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 24,
  xl: 26,
  pill: 30,
  round: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 30,
  xxl: 44,
} as const;

export const shadows = {
  button: {
    shadowColor: '#6E87EB',
    shadowOpacity: 0.42,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  card: {
    shadowColor: '#46508C',
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  chip: {
    shadowColor: '#46508C',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  floating: {
    shadowColor: '#46508C',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
} as const;

export const type = {
  splashTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.3, color: colors.ink },
  panelTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: colors.ink },
  deniedTitle: { fontFamily: fonts.display, fontSize: 29, lineHeight: 33, color: colors.ink },
  statsTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.ink },
  bigPct: { fontFamily: fonts.display, fontSize: 44, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  buttonLg: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.white },
  button: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.white },
  badge: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkMuted },
} as const;
