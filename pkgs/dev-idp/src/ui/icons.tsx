/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx';

export const BrandLogo = () => (
  <svg viewBox="0 0 48 48" focusable="false">
    <circle cx="24" cy="18" r="8" fill="#6366F1" />
    <path fill="#6366F1" d="M8 44 C 8 33 15 28 24 28 C 33 28 40 33 40 44 Z" />
  </svg>
);

const StrokedIconBase = (props: { children: Child }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
  >
    {props.children}
  </svg>
);

export const SunIcon = () => (
  <StrokedIconBase>
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  </StrokedIconBase>
);

export const SystemIcon = () => (
  <StrokedIconBase>
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  </StrokedIconBase>
);

export const MoonIcon = () => (
  <StrokedIconBase>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </StrokedIconBase>
);
