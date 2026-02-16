type A11yState = {
  disabled?: boolean;
  selected?: boolean;
  busy?: boolean;
  expanded?: boolean;
  checked?: boolean | 'mixed';
};

export const joinA11yLabel = (...parts: (string | number | null | undefined)[]): string => {
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(', ');
};

export const makeButtonA11y = (label: string, options?: { hint?: string; state?: A11yState }) => ({
  accessibilityRole: 'button' as const,
  accessibilityLabel: label,
  accessibilityHint: options?.hint,
  accessibilityState: options?.state,
});

export const makeTextA11y = (label: string) => ({
  accessibilityRole: 'text' as const,
  accessibilityLabel: label,
});
