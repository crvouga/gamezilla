/** Web brand artifacts (manifest, security.txt), rendered from the identity. */

import type { BrandArtifact } from './brand-artifacts.ts';
import { webOrigin } from './brand-hosts.ts';
import type { ProductIdentity } from './product-identity.ts';

const MANIFEST_ICONS = [192, 512].flatMap((size) =>
  (['any', 'maskable'] as const).map((purpose) => ({
    src: `/pwa/manifest-icon-${size}.maskable.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  }))
);

/** The installable web app's manifest (`<link rel="manifest">`). */
function renderWebManifest(identity: ProductIdentity): string {
  const manifest = {
    name: identity.brand.name,
    short_name: identity.brand.shortName,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: identity.brand.backgroundColor,
    theme_color: identity.brand.themeColor,
    icons: MANIFEST_ICONS,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** When the published security policy must be reviewed (RFC 9116 `Expires`). */
const SECURITY_TXT_EXPIRES = '2027-10-20T00:00:00.000Z';

/** RFC 9116 `/.well-known/security.txt`, served from the web origin. */
function renderSecurityTxt(identity: ProductIdentity): string {
  return [
    `Contact: ${identity.brand.securityContact}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    'Preferred-Languages: en',
    `Canonical: ${webOrigin(identity)}/.well-known/security.txt`,
    '',
  ].join('\n');
}

export const WEB_BRAND_ARTIFACTS: readonly BrandArtifact[] = [
  {
    path: 'apps/client-ts/public/pwa/manifest.webmanifest',
    render: renderWebManifest,
  },
  {
    path: 'apps/product-ts/public/.well-known/security.txt',
    render: renderSecurityTxt,
  },
];
