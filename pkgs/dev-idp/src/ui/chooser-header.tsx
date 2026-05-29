/** @jsxImportSource hono/jsx */
import { BrandLogo } from './icons';
import { c } from './styles';

export const ChooserHeader = () => (
  <header class={c.header} data-testid="dev-idp-header">
    <div class={c.brand} data-testid="dev-idp-brand" aria-label="Dev IdP">
      <span class={c.brandLogo} data-testid="dev-idp-brand-logo">
        <BrandLogo />
      </span>
      <span>Dev IdP</span>
    </div>
    <div
      id="dev-idp-theme-mount"
      data-testid="dev-idp-theme-mount"
      aria-label="Theme"
    />
  </header>
);
