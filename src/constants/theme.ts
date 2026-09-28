// src/constants/theme.ts — Sunbeam
// Drop this in to replace your existing theme tokens.

export const colors = {
  // Warm cream backgrounds (was #0A0A0A black)
  background:        '#FBF3E2',
  backgroundDeep:    '#F5E8C9',  // for soft radial header washes
  surface:           '#FFFFFF',
  surfaceHigh:       '#FFFAEE',
  surfaceBorder:     '#EADFC6',

  // Coral primary (was #2F80ED blue)
  primary:           '#E86A33',
  primaryInk:        '#B8451C',  // 2px bottom shadow / pressed state
  primaryWash:       '#FCE2D3',  // tinted chip background
  primaryGradient:   ['#F2A66C', '#E86A33'] as const,

  // Butter accent — match badges, secondary CTAs
  butter:            '#F5C84C',

  // Status
  success:           '#5BA888',  // muted mint (was iOS green)
  error:             '#C9412A',
  warning:           '#E6A93A',

  // Text — warm dark instead of pure black
  text:              '#2A1F14',
  textSecondary:     '#6B5A45',
  textLight:         '#A39079',

  border:            '#EADFC6',
  borderStrong:      '#D9C8A6',
  disabled:          '#E4D9BF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Bigger radii — softer, friendlier shapes
export const borderRadius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  full: 9999,
} as const;

export const typography = {
  // Display — Instrument Serif for editorial moments (dog names, hero text)
  display:    { fontFamily: 'InstrumentSerif', fontSize: 40, letterSpacing: -0.8 },
  displaySm:  { fontFamily: 'InstrumentSerif', fontSize: 32, letterSpacing: -0.5 },

  // Headings — Plus Jakarta Sans
  h1: { fontFamily: 'JakartaSans-Bold',   fontSize: 28, letterSpacing: -0.3 },
  h2: { fontFamily: 'JakartaSans-Bold',   fontSize: 22, letterSpacing: -0.2 },
  h3: { fontFamily: 'JakartaSans-Bold',   fontSize: 17 },

  body:       { fontFamily: 'JakartaSans',         fontSize: 15 },
  bodyBold:   { fontFamily: 'JakartaSans-Bold',    fontSize: 15 },
  bodySmall:  { fontFamily: 'JakartaSans',         fontSize: 13 },

  // Mono used sparingly for "INDEX" / "MATCH 92%" stamps if you want them
  caption: { fontFamily: 'JakartaSans-Bold', fontSize: 11, letterSpacing: 0.8 },
} as const;

// Shadows are warm-tinted (brown undertone, never pure black)
export const shadow = {
  sm: {
    shadowColor: '#5A3A1A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#5A3A1A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: '#5A3A1A',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  // Coral glow for the primary CTA
  primary: {
    shadowColor: '#E86A33',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
