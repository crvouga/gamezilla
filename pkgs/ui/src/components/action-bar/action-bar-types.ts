import type { ReactNode } from 'react';

export type ActionBarTextAction = {
  id: string;
  label: ReactNode;
  onPress: () => void;
  intent?: 'primary' | 'danger' | 'neutral';
  loading?: boolean;
  disabled?: boolean;
  overflow?: 'auto' | 'always' | 'never';
};
