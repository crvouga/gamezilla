import { Assert } from '@gamezilla/shared/assert';
import type { ConsensusResult, Vote } from './types';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export class ConsensusProtocol {
  private readonly peers: string[];
  private readonly quorum: number;
  private readonly votes = new Map<string, Map<string, 'ACK' | 'REJECT'>>();
  private readonly resolved = new Map<string, 'COMMITTED' | 'REJECTED'>();

  constructor(peers: string[], quorum?: number) {
    crash.ok(peers.length >= 2, 'peer-store requires at least 2 peers', {
      peer_count: peers.length,
    });

    const unique = new Set(peers);
    crash.ok(unique.size === peers.length, 'duplicate peer ids detected', {
      peers,
    });

    if (quorum !== undefined) {
      crash.ok(
        quorum > 0 && quorum <= peers.length,
        'quorum must be > 0 and <= peers.length',
        { quorum, peer_count: peers.length }
      );
    }

    this.peers = [...peers];
    this.quorum = quorum ?? Math.floor(peers.length / 2) + 1;

    crash.ok(
      this.quorum > 0 && this.quorum <= this.peers.length,
      'computed quorum out of range',
      { quorum: this.quorum, peer_count: this.peers.length }
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
    for (const v of command_votes.values()) {
      if (v === 'ACK') ack_count++;
      else reject_count++;
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
