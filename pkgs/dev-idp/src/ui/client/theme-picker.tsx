/** @jsxImportSource hono/jsx/dom */
/**
 * Client-side three-way theme picker (light / system / dark). Mirrors
 * the pre-paint script in {@link ../theme-pre-paint}: shared
 * `localStorage` key, shared `data-theme` / `data-theme-pref` HTML attrs,
 * shared resolution semantics for `system`.
 *
 * Mounts into `#dev-idp-theme-mount` (rendered by `page.tsx`). On
 * `prefers-color-scheme` changes from the OS, we re-resolve only when
 * the user's current preference is `system` so we don't fight an
 * explicit override.
 */
import { useEffect, useState } from 'hono/jsx';

import { MoonIcon, SunIcon, SystemIcon } from '../icons';
import { c } from '../styles';

const THEME_KEY = 'dev-idp.theme';
type ThemePref = 'light' | 'dark' | 'system';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* localStorage may throw in private mode; fall through to default */
  }
  return 'system';
}

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

function applyTheme(pref: ThemePref): void {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-pref', pref);
}

function persistPref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* swallow — picker still works for the current page */
  }
}

const ICON: Record<ThemePref, () => ReturnType<typeof SunIcon>> = {
  light: SunIcon,
  system: SystemIcon,
  dark: MoonIcon,
};

const ORDER: readonly ThemePref[] = ['light', 'system', 'dark'];

const LABEL: Record<ThemePref, string> = {
  light: 'Light',
  system: 'System',
  dark: 'Dark',
};

export const ThemePicker = () => {
  const [pref, setPref] = useState<ThemePref>(() => readPref());

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      if (readPref() === 'system') applyTheme('system');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const onSet = (next: ThemePref) => (): void => {
    persistPref(next);
    applyTheme(next);
    setPref(next);
  };

  return (
    <div
      class={c.themePicker}
      role="group"
      aria-label="Theme"
      data-testid="dev-idp-theme-picker"
    >
      {ORDER.map((p) => {
        const Icon = ICON[p];
        return (
          <button
            key={p}
            type="button"
            class={c.themeBtn}
            data-theme-set={p}
            data-testid={`dev-idp-theme-${p}`}
            title={LABEL[p]}
            aria-label={LABEL[p]}
            aria-pressed={pref === p ? 'true' : 'false'}
            onClick={onSet(p)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
};
