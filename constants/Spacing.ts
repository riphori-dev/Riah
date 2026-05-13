/**
 * Riah Spacing System
 * Consistent padding and margin values for a harmonious layout
 */

export const Spacing = {
  // Small spacing
  sm: 8,

  // Medium spacing (default)
  md: 16,

  // Large spacing
  lg: 24,

  // Extra large spacing
  xl: 32,

  // Additional useful values
  xs: 4,
  xxl: 40,
};

// Convenience export for common combinations
export const PaddingPresets = {
  small: Spacing.sm,
  default: Spacing.md,
  large: Spacing.lg,
  extraLarge: Spacing.xl,
};

export const MarginPresets = {
  small: Spacing.sm,
  default: Spacing.md,
  large: Spacing.lg,
  extraLarge: Spacing.xl,
};
