import { iosSimName } from './ios-sim-name';

const IOS_26_0 = 'com.apple.CoreSimulator.SimRuntime.iOS-26-0';
const IPHONE_17_PRO = 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro';
const IPAD_PRO_13_M4 =
  'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4-8GB';

export type SimPlatform = 'ios';

export type SimSpecEntry = {
  readonly id: string;
  readonly name: string;
  readonly platform: SimPlatform;
  readonly deviceType: string;
  readonly runtime: string;
};

/** Pinned iOS simulators for local dev. Names derive from device type + runtime. */
export const SIM_SPEC = [
  {
    id: 'iphone',
    name: iosSimName(IPHONE_17_PRO, IOS_26_0),
    platform: 'ios',
    deviceType: IPHONE_17_PRO,
    runtime: IOS_26_0,
  },
  {
    id: 'ipad',
    name: iosSimName(IPAD_PRO_13_M4, IOS_26_0),
    platform: 'ios',
    deviceType: IPAD_PRO_13_M4,
    runtime: IOS_26_0,
  },
] as const satisfies readonly SimSpecEntry[];

export type SimSpecId = (typeof SIM_SPEC)[number]['id'];

export function simSpecById(id: SimSpecId): SimSpecEntry {
  const entry = SIM_SPEC.find((row) => row.id === id);
  if (entry === undefined) {
    throw new Error(`Unknown simulator spec id "${id}".`);
  }
  return entry;
}
