export const colors = {
  primary: '#E8943A',
  primaryLight: '#F5B96A',
  primaryGradient: ['#E8943A', '#F5B96A'] as const,
  background: '#0C0B09',
  surface: '#151210',
  surfaceHigh: '#1E1B13',
  surfaceBorder: '#29241A',
  text: '#F0EBE3',          // warm soft white — easier on eyes than pure white
  textSecondary: '#908B84', // warm muted gray
  textLight: '#5E5A55',     // raised from #444 — was near-invisible on dark bg
  border: '#29241A',
  error: '#FF453A',
  success: '#34C759',
  warning: '#FFD60A',
  disabled: '#2A2A2A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.3 },
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;
