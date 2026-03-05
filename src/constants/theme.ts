export const colors = {
  primary: '#F4A261',
  primaryDark: '#E76F51',
  primaryLight: '#FDE8D8',
  secondary: '#2A9D8F',
  secondaryLight: '#E0F5F3',
  background: '#FFF8F0',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF3E8',
  text: '#2D1B0E',
  textSecondary: '#8B6355',
  textLight: '#C4A098',
  border: '#F0E0D6',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  disabled: '#E8D5CC',
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
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const shadow = {
  sm: {
    shadowColor: '#E76F51',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#E76F51',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#E76F51',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
