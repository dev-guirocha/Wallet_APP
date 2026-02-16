export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 24,
} as const;

export const radiusScale = [8, 12, 16, 24] as const;

export type RadiusToken = keyof typeof radius;
