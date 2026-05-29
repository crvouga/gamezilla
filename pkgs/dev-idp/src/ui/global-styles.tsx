/** @jsxImportSource hono/jsx */
/**
 * Global + atomic CSS for the dev IdP chooser. Theme tokens use
 * `[data-theme]`; component rules use stable `di-*` classes from
 * {@link ./styles.ts} so server HTML and client islands stay in sync.
 */

const GLOBAL_CSS = `
:root,
[data-theme='light'] {
  color-scheme: light;
  --fg: #1f1f1f;
  --fg-soft: #444;
  --muted: #5f6368;
  --bg: #f4f6fb;
  --card: #ffffff;
  --card-hover: #f8f9ff;
  --border: #e0e3eb;
  --border-strong: #c7cad1;
  --primary: #4f46e5;
  --primary-fg: #ffffff;
  --primary-soft: #eef2ff;
  --accent: #06b6d4;
  --danger: #c5221f;
  --shadow:
    0 4px 16px rgba(31, 31, 31, 0.04),
    0 1px 2px rgba(31, 31, 31, 0.06);
}
[data-theme='dark'] {
  color-scheme: dark;
  --fg: #f1f3f5;
  --fg-soft: #c5c9d0;
  --muted: #98a2b3;
  --bg: #0f1115;
  --card: #181b21;
  --card-hover: #1f232b;
  --border: #2a2f38;
  --border-strong: #3a4150;
  --primary: #8b8cf3;
  --primary-fg: #0f1115;
  --primary-soft: #1e1b4b;
  --accent: #22d3ee;
  --danger: #f28b82;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
}
.di-body {
  font:
    14px/1.5 -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  background: var(--bg);
  color: var(--fg);
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  margin: 0;
}
.di-card {
  width: 100%;
  max-width: 460px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 32px 28px 24px;
}
.di-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.di-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  font-weight: 600;
}
.di-brand-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.di-title {
  font-size: 22px;
  font-weight: 500;
  margin: 16px 0 4px;
  line-height: 1.3;
}
.di-subtitle {
  color: var(--muted);
  margin: 0 0 4px;
}
.di-client-pill {
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  display: none;
}
.di-client-pill[data-state='visible'] {
  display: inline-flex;
}
.di-client-pill::before {
  content: '↗';
  font-size: 11px;
}
.di-theme-picker {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--card-hover);
  border: 1px solid var(--border);
  border-radius: 999px;
}
.di-theme-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  padding: 0;
}
.di-theme-btn:hover {
  color: var(--fg);
  background: var(--border);
}
.di-theme-btn[aria-pressed='true'] {
  background: var(--card);
  color: var(--primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.di-theme-btn svg {
  width: 14px;
  height: 14px;
}
.di-section-label {
  margin: 24px 0 8px;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
}
.di-users {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.di-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  margin: 8px 0;
}
.di-user-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 120ms ease;
  border: 1px solid transparent;
}
.di-user-row:hover {
  background: var(--card-hover);
}
.di-user-row:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
.di-user-row[data-pending-delete='true'] {
  background: rgba(197, 34, 31, 0.06);
}
.di-user-row:hover .di-row-actions,
.di-user-row:focus-within .di-row-actions,
.di-user-row[data-pending-delete='true'] .di-row-actions {
  opacity: 1;
}
.di-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 15px;
  flex-shrink: 0;
  overflow: hidden;
}
.di-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.di-ident {
  flex: 1;
  min-width: 0;
}
.di-ident-name {
  font-weight: 500;
  color: var(--fg);
}
.di-ident-email {
  color: var(--muted);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.di-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 120ms ease;
}
.di-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  font: inherit;
  font-size: 15px;
}
.di-icon-btn:hover {
  background: var(--border);
  color: var(--fg);
}
.di-icon-btn[data-row-action='delete']:hover,
.di-icon-btn[data-row-action='confirm-delete'] {
  background: rgba(197, 34, 31, 0.12);
  color: var(--danger);
}
.di-utility-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  margin-top: 4px;
  border-radius: 12px;
  cursor: pointer;
  color: var(--primary);
  font-weight: 500;
}
.di-utility-row:hover {
  background: var(--card-hover);
}
.di-utility-plus {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-soft);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 400;
  flex-shrink: 0;
}
.di-panel {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card-hover);
  display: none;
}
.di-panel[data-state='open'] {
  display: block;
}
.di-panel-title {
  margin: 0 0 12px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted);
  font-weight: 600;
}
.di-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.di-field-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
.di-field-input {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--card);
  color: var(--fg);
  font: inherit;
}
.di-field-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
  border-color: transparent;
}
.di-panel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}
.di-btn {
  font: inherit;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--fg);
  font-weight: 500;
}
.di-btn:hover {
  background: var(--card-hover);
}
.di-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.di-submit-btn {
  font: inherit;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  background: var(--primary);
  color: var(--primary-fg);
  border: 1px solid transparent;
}
.di-submit-btn:hover {
  filter: brightness(1.05);
}
.di-submit-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.di-status {
  color: var(--muted);
  font-size: 12px;
  flex: 1;
  min-width: 0;
}
.di-status[data-state='error'] {
  color: var(--danger);
}
.di-disclaimer {
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 8px;
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.di-disclaimer::before {
  content: 'ℹ';
  font-size: 13px;
  flex-shrink: 0;
}
.di-foot {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}
.di-foot code {
  font:
    11px/1.4 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  word-break: break-all;
}
`;

export const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
);
