// @spec-interpretation
// Sources: specs/auth, specs/billing, specs/chess, specs/friends, specs/matchmaking, specs/profile, specs/room, specs/spaces, specs/sync-engine
// Literal adversarial traces supplement sampling; each asserts an observable
// outcome as well as the general safety predicate.
module adversarial_examples {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  export universe.*
  import product_state.* from "./product-state"
  import replication.* from "./replication"

  run lostAcknowledgementThenDeletionTest = init
    .then(emit(0,"write",0,1)).then(upload(0))
    .then(emit(2,"delete",0,0)).then(upload(2)).then(acknowledge(2))
    .then(upload(0)).then(acknowledge(0))
    .then(requestSnapshot(0)).then(receiveSnapshot(0))
    .expect(server.notes.get(0).deleted and syncView(clients,0).notes.get(0).deleted and invDurableIntent)

  run revokedOfflineIntentTest = init.then(disconnect(1))
    .then(emit(1,"write",0,2)).then(revoke(0)).then(reconnect(1)).then(tryUpload(1))
    .expect(server.notes.get(0).deleted and clients.decision == Map() and invSubsystems)

  run refreshedSessionCanUploadItsOwnOfflineQueueTest = init.then(disconnect(1))
    .then(emit(1,"write",0,2)).then(revoke(0)).then(reconnect(1)).then(signIn(1,0))
    .then(upload(1)).then(acknowledge(1))
    .expect(server.notes.get(0).value == 2 and clients.decision.get(0) == "applied" and invSubsystems)

  run switchedAccountDoesNotAdoptQueueTest = init.then(disconnect(0))
    .then(emit(0,"profile",0,2)).then(reconnect(0)).then(signIn(0,1))
    .then(upload(0)).then(acknowledge(0))
    .expect(server.profile.get(0) == 0 and server.profile.get(1) == 0 and clients.decision.get(0) == "rejected")

  run spaceEndsDuringOfflineEditTest = init.then(disconnect(2))
    .then(emit(2,"write",0,1)).then(emit(0,"end",0,0)).then(upload(0))
    .then(reconnect(2)).then(upload(2)).then(acknowledge(2))
    .expect(not(server.social.spaces.get(0).open) and clients.decision.get(1) == "applied" and clients.decision.get(0) == "rejected")

  run membershipExpiresBeforeAcceptanceTest = init
    .then(providerChange(0,0,"active",0)).then(requestSnapshot(1)).then(receiveSnapshot(1))
    .then(disconnect(1)).then(emit(1,"customize",0,2))
    .then(providerChange(0,0,"ended",0)).then(advanceTime(8))
    .then(reconnect(1)).then(upload(1)).then(acknowledge(1))
    .expect(server.feed.get(0) == 0 and clients.decision.get(0) == "rejected")

  run staleSnapshotAfterNewerSnapshotTest = init
    .then(emit(0,"write",0,1)).then(upload(0)).then(acknowledge(0)).then(requestSnapshot(2))
    .then(emit(0,"delete",0,0)).then(upload(0)).then(acknowledge(0))
    .then(receiveSnapshot(2)).then(requestSnapshot(2)).then(receiveSnapshot(2))
    .expect(clients.base.get(2).notes.get(0).deleted and invCheckpoints)

  run replyFromPreviousAccountIsDiscardedTest = init
    .then(emit(0,"profile",0,2)).then(upload(0)).then(requestSnapshot(1))
    .then(signIn(1,1)).then(receiveSnapshot(1))
    .expect(clients.checkpoint.get(1) == -1 and clients.owner.get(1) == 1)

  run repeatedPuzzleResultCountsOnceTest = init
    .then(emit(0,"start",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"finish",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(1,"finish",0,1)).then(upload(1)).then(upload(1)).then(acknowledge(1))
    .expect(server.game.rated.size() == 1 and server.game.results.get((0,0)) == "solved" and invSubsystems)

  run crashKeepsOfflineQueueTest = init.then(disconnect(1))
    .then(emit(1,"write",0,2)).then(crash(1)).then(reconnect(1)).then(restart(1))
    .then(upload(1)).then(acknowledge(1)).then(requestSnapshot(1)).then(receiveSnapshot(1))
    .expect(server.notes.get(0).value == 2 and clients.queue.get(1).length() == 0 and invDurableIntent)

  run blockBeforeInboxDeliveryTest = init
    .then(emit(0,"request",0,1)).then(upload(0)).then(acknowledge(0))
    .then(emit(2,"block",0,0)).then(upload(2)).then(deliverInbox(0,1))
    .expect(server.social.inbox == Set() and server.social.friends == Set() and invSubsystems)
  run staleSnapshotCannotRevivePushedDeletionTest = init
    .then(emit(0,"write",0,1)).then(upload(0)).then(acknowledge(0)).then(requestSnapshot(2))
    .then(emit(0,"delete",0,0)).then(upload(0)).then(applyPush(2))
    .then(receiveSnapshot(2))
    .expect(clients.base.get(2).notes.get(0).deleted and invNoTransitionViolation)

  run guestQuotaHasARefusalBoundaryTest = init
    .then(emit(3,"start",0,0)).then(upload(3)).then(acknowledge(3))
    .then(emit(3,"start",1,0)).then(upload(3)).then(acknowledge(3))
    .then(emit(3,"start",2,0)).then(upload(3)).then(acknowledge(3))
    .expect(server.game.charges.size() == 2 and clients.decision.get(2) == "rejected" and invSubsystems)

  run startedBeforeMidnightFinishesAfterMidnightTest = init
    .then(emit(3,"start",0,0)).then(upload(3)).then(acknowledge(3))
    .then(timePasses).then(emit(3,"finish",0,0)).then(upload(3))
    .expect(server.game.rated.contains((2,0)) and invSubsystems)

  run removedOfflineMemberCannotUploadTest = init.then(disconnect(2))
    .then(emit(2,"write",0,2)).then(emit(0,"remove-member",0,1)).then(upload(0)).then(acknowledge(0))
    .then(reconnect(2)).then(upload(2)).then(acknowledge(2))
    .expect(clients.decision.get(0) == "rejected" and server.notes.get(0).deleted)

  run publicLinkAllowsRemovedPersonToRejoinTest = init
    .then(emit(0,"remove-member",0,1)).then(upload(0)).then(acknowledge(0))
    .then(emit(2,"join",0,0)).then(upload(2)).then(acknowledge(2))
    .expect(server.social.spaces.get(0).members.contains(1) and invSubsystems)


  run deletionDoesNotGiveOfflineDeviceRemoteKnowledgeTest = init.then(disconnect(1))
    .then(confirmDeletion(0)).then(emit(1,"profile",0,2)).then(reconnect(1))
    .expect(clients.queue.get(1).length() == 1 and server.auth.removed.contains(0) and server.profile.get(0) == 0)

  run exportExpiresAndDeletionFinishesTest = init.then(requestExport(0)).then(exportReady(0))
    .then(advanceTime(7)).then(proveAgain(0)).then(confirmDeletion(0))
    .then(latePayment(0,0)).then(refundConfirmed(0,0)).then(advanceTime(30))
    .expect(server.privacy.stage.get(0) == "deleted" and server.privacy.exports.get(0) == "expired" and
      not(server.privacy.retained.contains(0)) and server.privacy.refundsPending == Set() and invSubsystems)

  run removedProviderCannotRemoveLastMethodTest = init.then(startLink(0,2)).then(finishLink(0,2))
    .then(unlinkMethod(0,2)).then(unlinkMethod(0,0))
    .expect(server.auth.active.contains(0) and not(server.auth.active.contains(2)) and invSubsystems)

  run secondProviderIdentityIsRefusedTest = init.then(startLink(0,4)).then(finishLink(0,4))
    .expect(server.auth.identityOwner.get(4) == -1 and invSubsystems)

  run relayAddressWaitsForConsentTest = init.then(automaticLink(0,3))
    .expect(server.auth.identityOwner.get(3) == -1 and server.auth.pending.get(3) == 0)

  run linkConsentFromOldSessionIsInvalidTest = init.then(startLink(0,2)).then(revoke(0))
    .then(signIn(0,0)).then(finishLink(0,2))
    .expect(server.auth.identityOwner.get(2) == -1 and invSubsystems)

  run onePersonCannotUndoSomeoneElsesBlockTest = init
    .then(emit(0,"block",0,1)).then(upload(0)).then(acknowledge(0))
    .then(emit(2,"block",0,0)).then(upload(2)).then(acknowledge(2))
    .then(emit(0,"unblock",0,1)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"request",0,1)).then(upload(0))
    .expect(server.social.blocked == Set((1,0)) and server.social.requests == Set() and invSubsystems)

  run aFinishedPairCanHaveAnotherMatchTest = init
    .then(emit(0,"wait",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(2,"wait",0,0)).then(upload(2)).then(acknowledge(2)).then(matchPeople(0,1)).then(finishMatch(0,1))
    .then(emit(0,"wait",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(2,"wait",0,0)).then(upload(2)).then(acknowledge(2)).then(matchPeople(0,1))
    .expect(server.game.matches.keys().size() == 2 and server.game.finished == Set(0) and invSubsystems)

  run offlineHostBoardAndDelayedOutcomeTest = init
    .then(emit(0,"select",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"start",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,0)).then(upload(0)).then(acknowledge(0))
    .then(requestSnapshot(1)).then(receiveSnapshot(1)).then(disconnect(1))
    .then(emit(1,"board-correct",0,0)).then(emit(1,"board-correct",0,0))
    .expect(syncView(clients,1).boards.get(0).phase == "solved" and server.boards.get(0).phase == "solving" and server.game.rated == Set())

  run unfinishedBoardResumesAfterLeavingTest = init
    .then(emit(0,"select",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"start",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-correct",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-exit",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,0)).then(upload(0))
    .expect(server.boards.get(0).position == 1 and server.boards.get(0).generation == 1 and invSubsystems)

  run acknowledgementKeepsSavedLocalRowsTest = init
    .then(emit(0,"write",0,2)).then(upload(0)).then(acknowledge(0))
    .expect(syncView(clients,0).notes.get(0).value == 2 and clients.checkpoint.get(0) == 0)

  run snapshotCapturedBeforeAcknowledgementIsDiscardedTest = init
    .then(emit(2,"profile",0,1)).then(upload(2)).then(acknowledge(2))
    .then(requestSnapshot(0)).then(emit(0,"write",0,2)).then(upload(0)).then(acknowledge(0))
    .then(receiveSnapshot(0))
    .expect(syncView(clients,0).notes.get(0).value == 2 and clients.checkpoint.get(0) == 0)

  run acknowledgementDoesNotOverwriteNewerPushTest = init
    .then(emit(0,"write",0,2)).then(upload(0))
    .then(emit(2,"delete",0,0)).then(upload(2)).then(applyPush(0))
    .then(acknowledge(0))
    .expect(syncView(clients,0).notes.get(0).deleted and invNoTransitionViolation)

  run usernameCaseClassCannotHaveTwoOwnersTest = init
    .then(emit(0,"rename",0,3)).then(emit(2,"rename",0,3)).then(upload(2)).then(upload(0))
    .expect(server.publicProfile.names.get(1) == 3 and server.publicProfile.names.get(0) == 0 and clients.decision.get(0) == "rejected")

  run duplicateRefundDoesNotConsumeAnotherChargeTest = init.then(confirmDeletion(0))
    .then(latePayment(0,0)).then(latePayment(0,1)).then(refundConfirmed(0,0)).then(latePayment(0,0))
    .then(cancellationConfirmed(0,0))
    .expect(server.privacy.refundsPending == Set((0,1)) and server.privacy.refunded == Set((0,0)) and
      server.privacy.cancellationPending == Set((0,1)) and invSubsystems)

  run deletionEndsReadyExportTest = init.then(requestExport(0)).then(exportReady(0)).then(confirmDeletion(0))
    .expect(server.privacy.exports.get(0) == "expired" and invSubsystems)

  // Minimized eight-device counterexample: membership reference is not presence.
  run delayedMembershipReferenceCannotRestoreDeletedAccountTest = init
    .then(register(2)).then(emit(0,"add-member",0,2)).then(eraseAccount(2)).then(upload(0))
    .then(emit(3,"write",0,2))
    .expect(server.social.spaces.get(0).access.contains(2) and not(server.social.spaces.get(0).members.contains(2)) and not(productPresent(server,0).contains(2)) and
      not(productCanSeeNotes(server,2)) and server.notes.get(0).deleted and invSubsystems)

  run provisionalPeerImageCannotBecomeAuthorityTest = init
    .then(emit(2,"write",0,2)).then(optimisticPeerPush(2,0))
    .then(emit(0,"remove-member",0,1)).then(upload(0)).then(acknowledge(0))
    .then(upload(2)).then(acknowledge(2)).then(requestSnapshot(0)).then(receiveSnapshot(0))
    .expect(server.notes.get(0).deleted and syncView(clients,0).notes.get(0).deleted and clients.peerNotes.get(0) == Map())

  run independentRoomCommandCanOvertakeSqlStartTest = init
    .then(emit(0,"select",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"start",0,0)).then(emit(0,"board-open",0,0)).then(uploadAt(0,1))
    .expect(server.boards.get(0).phase == "solving" and server.game.charges == Set() and not(clients.decision.keys().contains(1)))

  run savedResultSurvivesMovingToAnotherPuzzleTest = init
    .then(emit(0,"select",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"start",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-wrong",0,0)).then(upload(0)).then(acknowledge(0)).then(captureBoardOutcome(0))
    .then(emit(0,"board-reveal",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,1)).then(upload(0)).then(acknowledge(0)).then(recordBoardOutcome)
    .expect(server.boards.get(0).puzzle == 1 and server.game.results.get((0,0)) == "failed" and invNoTransitionViolation)

  // Source-backed progress limitation: restoration does not replay a missed live transition.
  run lostRoomObservationDoesNotPromiseARecordedResultTest = init
    .then(emit(0,"select",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"start",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-open",0,0)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"board-skip",0,0)).then(upload(0)).then(loseBoardNotification)
    .then(crash(0)).then(restart(0)).then(requestSnapshot(0)).then(receiveSnapshot(0))
    .expect(server.boards.get(0).phase == "skipped" and server.game.rated == Set() and server.game.outcomes == Set() and invSubsystems)

  run closedRequestDeliveryCannotCreateActiveNotificationTest = init
    .then(emit(0,"request",0,1)).then(upload(0)).then(acknowledge(0))
    .then(emit(0,"cancel-request",0,1)).then(upload(0)).then(acknowledge(0)).then(deliverInbox(0,1))
    .expect(server.notifications.active == Set() and invSubsystems)

  run notificationDismissalSurvivesRepeatedDeliveryTest = init
    .then(emit(0,"request",0,1)).then(upload(0)).then(acknowledge(0)).then(deliverInbox(0,1))
    .then(interactInbox(2,0,"dismiss")).then(deliverInbox(0,1))
    .expect(server.notifications.rows == Set((0,1)) and server.notifications.dismissed == Set((0,1)) and invSubsystems)

  run duplicateAcceptedCommandCannotChangeCanonicalStateTest = init
    .then(emit(0,"profile",0,2)).then(upload(0)).then(upload(0))
    .expect(server.revision == 1 and invNoTransitionViolation)

  run offlineHostCreatesAndSharesTheSameSpaceTest = init
    .then(providerChange(0,0,"active",0)).then(requestSnapshot(0)).then(receiveSnapshot(0))
    .then(disconnect(0)).then(emit(0,"create",1,0))
    .expect(syncView(clients,0).social.spaces.get(1).open and not(server.social.spaces.get(1).open))
    .then(crash(0)).then(restart(0))
    .expect(syncView(clients,0).social.spaces.get(1).open and clients.queue.get(0).length() == 1)
    .then(reconnect(0)).then(upload(0)).then(acknowledge(0))
    .expect(server.social.spaces.get(1).open and server.social.spaces.get(1).owner == 0 and invSubsystems)

  run offlineUsernameIsKeptAndSharedLaterTest = init
    .then(disconnect(0)).then(emit(0,"rename",0,3)).then(crash(0)).then(restart(0))
    .expect(syncView(clients,0).publicProfile.names.get(0) == 3 and server.publicProfile.names.get(0) == 0)
    .then(reconnect(0)).then(upload(0)).then(acknowledge(0))
    .expect(server.publicProfile.names.get(0) == 3 and invSubsystems)

  run offlineFriendRequestWaitsForSharingTest = init
    .then(disconnect(0)).then(emit(0,"request",0,1)).then(crash(0)).then(restart(0))
    .expect(syncView(clients,0).social.requests.contains((0,1)) and server.social.requests == Set())
    .then(reconnect(0)).then(upload(0)).then(acknowledge(0)).then(deliverInbox(0,1))
    .expect(server.social.requests.contains((0,1)) and server.social.inbox.contains((0,1)) and invSubsystems)

  run addingAccessWaitsForExplicitJoinTest = init
    .then(emit(0,"remove-member",0,1)).then(upload(0)).then(acknowledge(0))
    .then(disconnect(0)).then(emit(0,"add-member",0,1))
    .expect(syncView(clients,0).social.spaces.get(0).access.contains(1) and not(syncView(clients,0).social.spaces.get(0).members.contains(1)))
    .then(reconnect(0)).then(upload(0)).then(acknowledge(0))
    .expect(server.social.spaces.get(0).access.contains(1) and not(server.social.spaces.get(0).members.contains(1)))
    .then(emit(2,"join",0,0)).then(upload(2)).then(acknowledge(2))
    .expect(server.social.spaces.get(0).members.contains(1) and invSubsystems)

  run joiningWaitsForTheHostToReturnTest = init
    .then(emit(0,"remove-member",0,1)).then(upload(0)).then(acknowledge(0))
    .then(disconnect(0)).then(disconnect(1))
    .then(emit(2,"join",0,0)).then(upload(2)).then(acknowledge(2))
    .expect(clients.decision.get(1) == "rejected" and not(server.social.spaces.get(0).members.contains(1)))
    .then(reconnect(0)).then(emit(2,"join",0,0)).then(upload(2)).then(acknowledge(2))
    .expect(server.social.spaces.get(0).members.contains(1) and invSubsystems)

  run hostLeavesInsteadOfRemovingThemselvesTest = init
    .then(emit(0,"remove-member",0,0)).then(upload(0)).then(acknowledge(0))
    .expect(server.social.spaces.get(0).open and server.social.spaces.get(0).members.contains(0) and clients.decision.get(0) == "rejected")
    .then(disconnect(0)).then(emit(0,"leave",0,0))
    .expect(not(syncView(clients,0).social.spaces.get(0).open) and server.social.spaces.get(0).open)
    .then(reconnect(0)).then(upload(0)).then(acknowledge(0))
    .expect(not(server.social.spaces.get(0).open) and invSubsystems)

  run offlineMembershipConfirmationExpiresOnDeviceClockTest = init
    .then(providerChange(0,0,"active",30)).then(requestSnapshot(1)).then(receiveSnapshot(1))
    .then(disconnect(1)).then(advanceTime(8)).then(emit(1,"customize",0,2))
    .expect(clients.clock.get(1) == 8 and syncView(clients,1).feed.get(0) == 0 and
      clients.base.get(1).billing.rows.get((0,0)).status == "active" and invSubsystems)

}
