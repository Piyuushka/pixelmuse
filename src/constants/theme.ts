/**
 * Theme & Color Constants
 * Accessible Modern Fidelity Design Palette
 */
export const THEME_COLORS = {
  primary: '#2563EB',       // Electric Blue
  primaryContainer: '#1D4ED8',
  secondary: '#059669',     // Emerald Green
  secondaryContainer: '#D1FAE5',
  tertiary: '#FACC15',      // Yellow / Amber
  tertiaryContainer: '#FEF08A',
  neutral: '#D6D7DD',       // Light Gray Border/Container
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  success: '#059669',
  warning: '#D97706',
  darkGray: '#475569',
  white: '#FFFFFF',
} as const;

export const PERSONA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  wheelchair: {
    bg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  'older-adult': {
    bg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
  },
  'low-vision': {
    bg: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
  caregiver: {
    bg: 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-700',
  },
};
