import type {
  ConsoleNavPatch,
  ConsoleNavState,
} from '@product/console/console-nav/console-nav';
import { createContext, useContext } from 'solid-js';

export type ConsoleChromeContextValue = {
  readonly state: ConsoleNavState;
  readonly patch: (partial: ConsoleNavPatch, mode?: 'push' | 'replace') => void;
};

const ConsoleChromeContext = createContext<ConsoleChromeContextValue | null>(
  null
);

export const ConsoleChromeProvider = ConsoleChromeContext.Provider;

export function useConsoleChrome(): ConsoleChromeContextValue {
  const value = useContext(ConsoleChromeContext);
  if (value === null) {
    throw new Error('useConsoleChrome requires ConsoleChromeProvider');
  }
  return value;
}
