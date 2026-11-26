import type { UiTheme } from '../types';

export const UI_THEME_LABELS: Record<UiTheme, string> = {
  default: 'Obsidian Dark (Present)',
  crystal_glass: 'Silver Crystal Glass',
  glassmorphism_20: 'Glassmorphism (20% Opacity)',
};

/** Normalize persisted theme strings into a supported UiTheme variant. */
export function normalizeUiTheme(val?: string | null): UiTheme {
  if (val === 'crystal_glass' || val === 'glassmorphism_20' || val === 'default') {
    return val;
  }
  return 'default';
}
