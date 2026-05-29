/**
 * Stable atomic class names for the dev IdP chooser. Rules live in
 * {@link ./global-styles.tsx} so SSR and client hydration share one
 * stylesheet without relying on `hono/css` runtime injection (which only
 * runs inside Hono's HTML pipeline, not our standalone `toString()` render).
 */
export const c = {
  header: 'di-header',
  body: 'di-body',
  card: 'di-card',
  brand: 'di-brand',
  brandLogo: 'di-brand-logo',
  title: 'di-title',
  subtitle: 'di-subtitle',
  clientPill: 'di-client-pill',
  themePicker: 'di-theme-picker',
  themeBtn: 'di-theme-btn',
  sectionLabel: 'di-section-label',
  users: 'di-users',
  empty: 'di-empty',
  userRow: 'di-user-row',
  avatar: 'di-avatar',
  ident: 'di-ident',
  identName: 'di-ident-name',
  identEmail: 'di-ident-email',
  rowActions: 'di-row-actions',
  iconBtn: 'di-icon-btn',
  utilityRow: 'di-utility-row',
  utilityPlus: 'di-utility-plus',
  panel: 'di-panel',
  panelTitle: 'di-panel-title',
  field: 'di-field',
  fieldLabel: 'di-field-label',
  fieldInput: 'di-field-input',
  panelActions: 'di-panel-actions',
  btn: 'di-btn',
  submitBtn: 'di-submit-btn',
  status: 'di-status',
  disclaimer: 'di-disclaimer',
  foot: 'di-foot',
} as const;
