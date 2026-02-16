import type { ViewStyle } from 'react-native';

type ShadowStyle = Readonly<ViewStyle>;

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
} as const satisfies Record<'sm' | 'md', ShadowStyle>;

export type ShadowToken = keyof typeof shadows;
