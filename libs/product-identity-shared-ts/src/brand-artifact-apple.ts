/**
 * Apple client brand artifacts, rendered from the identity: a Swift source
 * the app and its UI tests compile (`ProductIdentity.displayName`), and an
 * xcconfig the Xcode project bases every configuration on, so the project
 * file spells neither the display name nor the bundle identifier.
 */
import type { BrandArtifact } from './brand-artifacts.ts';
import type { ProductIdentity } from './product-identity.ts';

const GENERATOR =
  'bun run libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts';
const SOURCE = 'libs/product-identity/product-identity.json';

/** A Swift string literal holding exactly `value`. */
function swiftString(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '"' || char === '\\') out += `\\${char}`;
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`;
    else out += char;
  }
  return `"${out}"`;
}

/**
 * An xcconfig value holding exactly `value`. The format has no escapes, so a
 * value it cannot hold fails the generator rather than build another one.
 */
function xcconfigValue(name: string, value: string): string {
  if (/[\n\r$]|\/\/|^\s|\s$/.test(value))
    throw new Error(`${name} cannot be written to an xcconfig: ${value}`);
  return value;
}

function renderSwift(identity: ProductIdentity): string {
  return [
    `// Generated from ${SOURCE}; do not edit.`,
    `// Regenerate: ${GENERATOR}`,
    '',
    '/// The product identity, read instead of spelling the brand.',
    'enum ProductIdentity {',
    '  /// The name people see.',
    `  static let displayName = ${swiftString(identity.brand.name)}`,
    '}',
    '',
  ].join('\n');
}

function renderXcconfig(identity: ProductIdentity): string {
  return [
    `// Generated from ${SOURCE}; do not edit.`,
    `// Regenerate: ${GENERATOR}`,
    '//',
    '// The base configuration of every build configuration in',
    '// apple-client.xcodeproj, which reads these instead of spelling them.',
    '',
    '// The name under the app icon (brand.name).',
    `PRODUCT_IDENTITY_DISPLAY_NAME = ${xcconfigValue('brand.name', identity.brand.name)}`,
    '',
    '// The registered bundle identifier (external.appleBundleId).',
    `PRODUCT_IDENTITY_BUNDLE_ID = ${xcconfigValue('external.appleBundleId', identity.external.appleBundleId)}`,
    '',
  ].join('\n');
}

export const APPLE_BRAND_ARTIFACTS: readonly BrandArtifact[] = [
  {
    path: 'apps/client-swift/src/product-identity.generated.swift',
    render: renderSwift,
  },
  {
    path: 'apps/client-swift/config/product-identity.generated.xcconfig',
    render: renderXcconfig,
  },
];
