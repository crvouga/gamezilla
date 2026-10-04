import type { CurrentSearch, SearchRequest } from './identity';
import type { DistanceFormula, JoinInput, JoinResult, LeaveResult, UpdateFormulasResult } from './types';
import type { Matchmaking } from './matchmaking';
import { DEFAULT_RADIUS_OPTIONS } from './types';
import { expandingRadius } from './compatibility';

export type DevicePorts = {
  readonly matchmaking: () => Pick<
    Matchmaking,
    'join' | 'leave' | 'updateFormulas' | 'current'
  >;
};

/** A connected device receives current outcomes; an offline device keeps its last view. */
export class MatchmakingDevice {
  private online = true;
  private known: CurrentSearch | null = null;
  private readVersion = 0;

  constructor(
    readonly ownerId: string,
    private readonly ports: DevicePorts
  ) {}

  connected(): boolean {
    return this.online;
  }
  view(): CurrentSearch | null {
    return this.known;
  }

  range(): number {
    const known = this.known;
    if (known === null) return 5;
    const formula = known.formulas[0]?.radius;
    const radius =
      formula === undefined
        ? DEFAULT_RADIUS_OPTIONS
        : {
            baseRadius: formula.baseRadius ?? 0,
            radiusGrowthPerSecond: formula.radiusGrowthPerSecond ?? 0,
            maxRadius: formula.maxRadius ?? formula.baseRadius ?? 0,
          };
    return expandingRadius(known.joinedAtMs, known.observedAtMs, radius);
  }

  async setConnected(online: boolean): Promise<void> {
    this.online = online;
    this.readVersion++;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.online) return;
    const version = ++this.readVersion;
    const current = await this.ports.matchmaking().current(this.ownerId);
    if (this.online && version === this.readVersion) this.known = current;
  }

  async begin(input: Omit<JoinInput, 'ownerId'>): Promise<JoinResult | null> {
    if (!this.online) return null;
    const result = await this.ports
      .matchmaking()
      .join({ ...input, ownerId: this.ownerId });
    await this.refresh();
    return result;
  }

  async stop(
    input: Omit<SearchRequest, 'ownerId'>
  ): Promise<LeaveResult | null> {
    if (!this.online) return null;
    const result = await this.ports
      .matchmaking()
      .leave({ ...input, ownerId: this.ownerId });
    await this.refresh();
    return result;
  }

  async change(
    input: Omit<SearchRequest, 'ownerId'>,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult | null> {
    if (!this.online) return null;
    const result = await this.ports
      .matchmaking()
      .updateFormulas({ ...input, ownerId: this.ownerId }, formulas);
    await this.refresh();
    return result;
  }
}
