/**
 * Paddle prices regional amounts by *country* (`unit_price_overrides`), while
 * the offer prices them by *currency*. This is the bridge: the countries whose
 * buyers are charged each offer currency. A currency not listed here — one
 * Paddle does not settle in, or one not mapped yet — is left out of the
 * Paddle price, and those buyers pay the base price.
 */
const EUROZONE = [
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
] as const;

export const PADDLE_CURRENCY_COUNTRIES: Readonly<
  Record<string, readonly string[]>
> = {
  aud: ['AU'],
  brl: ['BR'],
  cad: ['CA'],
  eur: EUROZONE,
  gbp: ['GB'],
  inr: ['IN'],
  jpy: ['JP'],
  mxn: ['MX'],
  sgd: ['SG'],
  zar: ['ZA'],
};
