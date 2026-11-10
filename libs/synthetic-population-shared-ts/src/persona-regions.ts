/**
 * Real home regions a Synthetic User comes from, with their IANA time zone
 * and its standard offset from UTC in minutes. Daily schedules keep to
 * standard time all year: a Synthetic User's day does not move with
 * daylight saving.
 */
export const HOME_REGIONS: readonly {
  readonly region: string;
  readonly timeZone: string;
  readonly utcOffsetMinutes: number;
}[] = [
  {
    region: 'Chicago, US',
    timeZone: 'America/Chicago',
    utcOffsetMinutes: -360,
  },
  {
    region: 'New York, US',
    timeZone: 'America/New_York',
    utcOffsetMinutes: -300,
  },
  {
    region: 'Los Angeles, US',
    timeZone: 'America/Los_Angeles',
    utcOffsetMinutes: -480,
  },
  { region: 'Denver, US', timeZone: 'America/Denver', utcOffsetMinutes: -420 },
  {
    region: 'Toronto, CA',
    timeZone: 'America/Toronto',
    utcOffsetMinutes: -300,
  },
  {
    region: 'Vancouver, CA',
    timeZone: 'America/Vancouver',
    utcOffsetMinutes: -480,
  },
  {
    region: 'Mexico City, MX',
    timeZone: 'America/Mexico_City',
    utcOffsetMinutes: -360,
  },
  { region: 'Bogotá, CO', timeZone: 'America/Bogota', utcOffsetMinutes: -300 },
  { region: 'Lima, PE', timeZone: 'America/Lima', utcOffsetMinutes: -300 },
  {
    region: 'São Paulo, BR',
    timeZone: 'America/Sao_Paulo',
    utcOffsetMinutes: -180,
  },
  {
    region: 'Buenos Aires, AR',
    timeZone: 'America/Argentina/Buenos_Aires',
    utcOffsetMinutes: -180,
  },
  {
    region: 'St. John’s, CA',
    timeZone: 'America/St_Johns',
    utcOffsetMinutes: -210,
  },
  { region: 'London, UK', timeZone: 'Europe/London', utcOffsetMinutes: 0 },
  { region: 'Dublin, IE', timeZone: 'Europe/Dublin', utcOffsetMinutes: 0 },
  { region: 'Lisbon, PT', timeZone: 'Europe/Lisbon', utcOffsetMinutes: 0 },
  { region: 'Madrid, ES', timeZone: 'Europe/Madrid', utcOffsetMinutes: 60 },
  { region: 'Paris, FR', timeZone: 'Europe/Paris', utcOffsetMinutes: 60 },
  { region: 'Berlin, DE', timeZone: 'Europe/Berlin', utcOffsetMinutes: 60 },
  {
    region: 'Amsterdam, NL',
    timeZone: 'Europe/Amsterdam',
    utcOffsetMinutes: 60,
  },
  {
    region: 'Stockholm, SE',
    timeZone: 'Europe/Stockholm',
    utcOffsetMinutes: 60,
  },
  { region: 'Warsaw, PL', timeZone: 'Europe/Warsaw', utcOffsetMinutes: 60 },
  { region: 'Athens, GR', timeZone: 'Europe/Athens', utcOffsetMinutes: 120 },
  {
    region: 'Istanbul, TR',
    timeZone: 'Europe/Istanbul',
    utcOffsetMinutes: 180,
  },
  { region: 'Cairo, EG', timeZone: 'Africa/Cairo', utcOffsetMinutes: 120 },
  { region: 'Lagos, NG', timeZone: 'Africa/Lagos', utcOffsetMinutes: 60 },
  { region: 'Nairobi, KE', timeZone: 'Africa/Nairobi', utcOffsetMinutes: 180 },
  {
    region: 'Johannesburg, ZA',
    timeZone: 'Africa/Johannesburg',
    utcOffsetMinutes: 120,
  },
  { region: 'Dubai, AE', timeZone: 'Asia/Dubai', utcOffsetMinutes: 240 },
  { region: 'Tehran, IR', timeZone: 'Asia/Tehran', utcOffsetMinutes: 210 },
  { region: 'Karachi, PK', timeZone: 'Asia/Karachi', utcOffsetMinutes: 300 },
  { region: 'Mumbai, IN', timeZone: 'Asia/Kolkata', utcOffsetMinutes: 330 },
  {
    region: 'Kathmandu, NP',
    timeZone: 'Asia/Kathmandu',
    utcOffsetMinutes: 345,
  },
  { region: 'Dhaka, BD', timeZone: 'Asia/Dhaka', utcOffsetMinutes: 360 },
  { region: 'Bangkok, TH', timeZone: 'Asia/Bangkok', utcOffsetMinutes: 420 },
  { region: 'Jakarta, ID', timeZone: 'Asia/Jakarta', utcOffsetMinutes: 420 },
  { region: 'Manila, PH', timeZone: 'Asia/Manila', utcOffsetMinutes: 480 },
  {
    region: 'Singapore, SG',
    timeZone: 'Asia/Singapore',
    utcOffsetMinutes: 480,
  },
  { region: 'Shanghai, CN', timeZone: 'Asia/Shanghai', utcOffsetMinutes: 480 },
  { region: 'Seoul, KR', timeZone: 'Asia/Seoul', utcOffsetMinutes: 540 },
  { region: 'Tokyo, JP', timeZone: 'Asia/Tokyo', utcOffsetMinutes: 540 },
  {
    region: 'Adelaide, AU',
    timeZone: 'Australia/Adelaide',
    utcOffsetMinutes: 570,
  },
  { region: 'Sydney, AU', timeZone: 'Australia/Sydney', utcOffsetMinutes: 600 },
  {
    region: 'Auckland, NZ',
    timeZone: 'Pacific/Auckland',
    utcOffsetMinutes: 720,
  },
];
