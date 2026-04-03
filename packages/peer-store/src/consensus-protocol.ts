import { Assert } from '@gamezilla/shared/assert';
import type { ConsensusResult, Vote } from './types';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export class ConsensusProtocol {
  private readonly peers: string[];
  private readonly weights: Map<string, number>;
  private readonly quorum: number;
  private readonly votes = new Map<string, Map<string, 'ACK' | 'REJECT'>>();
  private readonly resolved = new Map<string, 'COMMITTED' | 'REJECTED'>();

  constructor(
    peers: string[],
    quorum?: number,
    weights?: Record<string, number>
  ) {
    crash.ok(peers.length >= 2, 'peer-store requires at least 2 peers', {
      peer_count: peers.length,
    });

    const unique = new Set(peers);
    crash.ok(unique.size === peers.length, 'duplicate peer ids detected', {
      peers,
    });

    this.peers = [...peers];
    this.weights = new Map();
    for (const peer of this.peers) {
      const w = weights?.[peer] ?? 1;
      crash.ok(w > 0, `weight for peer ${peer} must be > 0`, { weight: w });
      this.weights.set(peer, w);
    }

    const total_weight = [...this.weights.values()].reduce((a, b) => a + b, 0);
    const default_quorum = Math.floor(total_weight / 2) + 1;

    if (quorum !== undefined) {
      crash.ok(
        quorum > 0 && quorum <= total_weight,
        'quorum must be > 0 and <= total weight',
        { quorum, total_weight }
      );
    }

    this.quorum = quorum ?? default_quorum;

    crash.ok(
      this.quorum > 0 && this.quorum <= total_weight,
      'computed quorum out of range',
      { quorum: this.quorum, total_weight }
    );
  }

  isResolved(commandId: string): boolean {
    return this.resolved.has(commandId);
  }

  record(vote: Vote): ConsensusResult {
    validation.ok(
      vote.vote === 'ACK' || vote.vote === 'REJECT',
      `vote must be ACK or REJECT, got: ${vote.vote}`
    );
    validation.ok(
      this.peers.includes(vote.from),
      `unknown peer: ${vote.from}`,
      { peers: this.peers }
    );
    crash.ok(
      !this.resolved.has(vote.commandId),
      `commandId already resolved: ${vote.commandId}`
    );

    if (!this.votes.has(vote.commandId)) {
      this.votes.set(vote.commandId, new Map());
    }

    const command_votes = this.votes.get(vote.commandId)!;
    command_votes.set(vote.from, vote.vote);

    let ack_count = 0;
    let reject_count = 0;
    for (const [peerId, v] of command_votes.entries()) {
      const w = this.weights.get(peerId) ?? 1;
      if (v === 'ACK') ack_count += w;
      else reject_count += w;
    }

    if (ack_count >= this.quorum) {
      this.resolved.set(vote.commandId, 'COMMITTED');
      return { status: 'COMMITTED' };
    }

    if (reject_count >= this.quorum) {
      this.resolved.set(vote.commandId, 'REJECTED');
      const bad_actors = this.computeBadActors(vote.commandId, 'REJECTED');
      return { status: 'REJECTED', badActors: bad_actors };
    }

    return { status: 'PENDING' };
  }

  getBadActors(commandId: string): string[] {
    crash.ok(
      this.resolved.has(commandId),
      `commandId not resolved: ${commandId}`
    );
    const outcome = this.resolved.get(commandId)!;
    return this.computeBadActors(commandId, outcome);
  }

  getWeight(peerId: string): number {
    return this.weights.get(peerId) ?? 1;
  }

  reset(commandId: string): void {
    this.votes.delete(commandId);
    this.resolved.delete(commandId);
  }

  private computeBadActors(
    commandId: string,
    outcome: 'COMMITTED' | 'REJECTED'
  ): string[] {
    const command_votes = this.votes.get(commandId);
    if (!command_votes) return [];

    const minority_vote = outcome === 'COMMITTED' ? 'REJECT' : 'ACK';
    const bad_actors: string[] = [];
    for (const [peerId, vote] of command_votes.entries()) {
      if (vote === minority_vote) bad_actors.push(peerId);
    }
    return bad_actors;
  }
}
