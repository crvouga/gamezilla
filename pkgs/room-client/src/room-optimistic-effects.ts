import type { Clock } from '@pkgs/clock-shared/types';
import type { Message } from '@pkgs/message-shared/message';

import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-shared/builtin';
import type { RoomEffectHandler } from '@pkgs/room-shared/handler';
import { applyRoomEffects } from '@pkgs/room-shared/handler';
import type { RoomEffect } from '@pkgs/room-shared/types';

/**
 * Tracks schedule ids armed from optimistic handle effects so rebases can
 * CancelSchedule them before replaying the remaining queue's effects.
 */
export class OptimisticEffectSession {
  private readonly armedIds = new Set<string>();
  private readonly byCommand = new Map<string, readonly RoomEffect[]>();

  constructor(
    private readonly topic: string,
    private readonly clock: Clock,
    private readonly handlers: readonly RoomEffectHandler[],
    private readonly injectCommand: (args: {
      readonly id: string;
      readonly payload: Message;
      readonly identity: string;
    }) => void | Promise<void>
  ) {}

  remember(commandId: string, effects: readonly RoomEffect[]): void {
    if (effects.length === 0) {
      this.byCommand.delete(commandId);
      return;
    }
    this.byCommand.set(commandId, effects);
  }

  forget(commandId: string): void {
    this.byCommand.delete(commandId);
  }

  clear(): void {
    this.byCommand.clear();
  }

  /** Cancel prior optimistic schedules, then re-apply effects in queue order. */
  async refresh(commandIdsInOrder: readonly string[]): Promise<void> {
    if (this.handlers.length === 0) return;
    const cancels = [...this.armedIds].map((id) =>
      CancelScheduleEffect({ id })
    );
    this.armedIds.clear();
    if (cancels.length > 0) {
      await applyRoomEffects(cancels, this.handlers, this.ctx());
    }
    for (const commandId of commandIdsInOrder) {
      const effects = this.byCommand.get(commandId);
      if (effects === undefined || effects.length === 0) continue;
      this.trackArmed(effects);
      await applyRoomEffects(effects, this.handlers, this.ctx());
    }
  }

  async applyNew(
    commandId: string,
    effects: readonly RoomEffect[]
  ): Promise<void> {
    this.remember(commandId, effects);
    if (effects.length === 0 || this.handlers.length === 0) return;
    this.trackArmed(effects);
    await applyRoomEffects(effects, this.handlers, this.ctx());
  }

  private trackArmed(effects: readonly RoomEffect[]): void {
    for (const effect of effects) {
      if (ScheduleEffect.is(effect)) {
        this.armedIds.add(effect.payload.id);
      } else if (CancelScheduleEffect.is(effect)) {
        this.armedIds.delete(effect.payload.id);
      }
    }
  }

  private ctx() {
    return {
      topic: this.topic,
      clock: this.clock,
      now: this.clock.now(),
      injectCommand: this.injectCommand,
    };
  }
}
