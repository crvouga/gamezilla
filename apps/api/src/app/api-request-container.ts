import { FriendBlockService } from '@libs/friends/server/friend-block-service';
import { FriendSearchService } from '@libs/friends/server/friend-search-service';
import { FriendService } from '@libs/friends/server/friend-service';
import { FriendsInboxActionHandler } from '@libs/friends/server/friends-inbox-actions';
import { FriendsInboxPublisher } from '@libs/friends/server/friends-inbox-publisher';
import { FriendshipStatusService } from '@libs/friends/server/friendship-status-service';
import { FriendRequestRepository } from '@libs/friends/shared/friends-sql/friend-request-repository';
import { FriendshipRepository } from '@libs/friends/shared/friends-sql/friendship-repository';
import { UserBlockRepository } from '@libs/friends/shared/friends-sql/user-block-repository';
import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Per-request composition root. Built when the request DB opens; holds
 * constructor-injected repositories/services for the request lifetime.
 */
export class ApiRequestContainer {
  readonly friendRequestRepository: FriendRequestRepository;
  readonly friendshipRepository: FriendshipRepository;
  readonly userBlockRepository: UserBlockRepository;
  readonly friendsInboxPublisher: FriendsInboxPublisher;
  readonly friendBlockService: FriendBlockService;
  readonly friendshipStatusService: FriendshipStatusService;
  readonly friendSearchService: FriendSearchService;
  readonly friendService: FriendService;
  readonly friendsInboxActionHandler: FriendsInboxActionHandler;

  constructor(db: SqlClient, io: Io) {
    const createId = io.createId;
    const now = io.clock.now;

    this.friendRequestRepository = new FriendRequestRepository(db);
    this.friendshipRepository = new FriendshipRepository(db);
    this.userBlockRepository = new UserBlockRepository(db, createId);
    this.friendsInboxPublisher = new FriendsInboxPublisher(db, now, createId);
    this.friendBlockService = new FriendBlockService(
      db,
      createId,
      this.friendsInboxPublisher
    );
    this.friendshipStatusService = new FriendshipStatusService(
      db,
      this.friendsInboxPublisher
    );
    this.friendSearchService = new FriendSearchService(db);
    this.friendService = new FriendService(this.friendSearchService);
    this.friendsInboxActionHandler = new FriendsInboxActionHandler(
      db,
      now,
      createId,
      this.friendsInboxPublisher
    );
  }
}
