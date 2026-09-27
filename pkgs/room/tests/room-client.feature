Feature: Room client
  A room client shows a person the room as it will be once their commands
  land: the committed log from the server with their own pending commands
  replayed on top. It keeps the log and the pending commands on the device,
  so a restart picks up where it left off, and it re-syncs whenever its copy
  of the log cannot be trusted.

  Rule: A client syncs before it sends

    Scenario: Opening a room asks the server for the whole log
      Given alice opens a cursor room
      Then alice's device has asked to sync from sequence number 0

    Scenario: A move made before the welcome shows at once but waits to be sent
      Given alice opens a cursor room
      When alice moves to 1, 2
      Then alice's cursor shows at 1, 2
      And the room is not synced
      And alice's device has sent 0 commands

    Scenario: The welcome syncs the room and sends what waited
      Given alice opens a cursor room
      And alice has moved to 1, 2
      When the welcome arrives
      And alice's device writes to storage
      Then the room is synced
      And alice's device has sent 1 command
      And the stored queue holds the pending commands

    Scenario: Waiting for sync gives up when its timer fires
      Given alice opens a cursor room
      When alice waits up to 10 ms for sync and the timer fires
      Then the wait fails with a timeout

    Scenario: Waiting for sync ends when the welcome arrives
      Given alice opens a cursor room
      When alice waits up to 10 ms for sync
      And the welcome arrives
      Then the wait succeeds

  Rule: Pending commands are replayed on the committed log

    Scenario: A commit that matches the prediction needs no replay
      Given alice's room is synced
      And alice has moved along x to 1, 2 and 3
      When the server commits alice's move 1 as predicted
      Then 0 commands were replayed
      And the snapshot is the same object as before
      And 2 commands are pending
      And the last sequence number is 1

    Scenario: Someone else's commit replays the pending commands
      Given alice's room is synced
      And alice has moved along x to 1, 2 and 3
      And the server has committed alice's move 1 as predicted
      When the server commits bob's move to 9, 0
      Then 2 commands were replayed
      And bob's cursor shows at 9, 0
      And alice's cursor shows at 3, 0
      And the room counts 4 moves

    Scenario: A commit that differs from the prediction replays the pending commands
      Given alice's room is synced
      And alice has moved along x to 1, 2 and 3
      And the server has committed alice's move 1 as predicted
      And the server has committed bob's move to 9, 0
      When the server commits alice's move 2 landing at 7, 0
      Then 1 command was replayed
      And alice's cursor shows at 3, 0

    Scenario: A refused command is dropped and the refusal shown
      Given alice's room is synced
      And alice has moved to 5, 5
      When the server refuses alice's move 1 as a conflict "nope"
      Then alice's cursor is not shown
      And alice's device reported a conflict "nope"
      And the room shows the last error as a conflict "nope"

    Scenario: The outbound queue is bounded
      Given alice opens a cursor room
      When alice makes one move more than the outbound queue holds
      Then alice's device reported being rate-limited
      And as many commands are pending as the outbound queue holds

  Rule: Snapshots and logs change identity only when they change

    Scenario: A roster leaves the snapshot as it was
      Given alice's room is synced
      When a roster listing alice arrives
      Then the snapshot is the same object as before
      And the room's roster lists alice

    Scenario: A commit gives a new snapshot
      Given alice's room is synced
      When the server commits bob's move to 1, 0
      Then the snapshot is a new object

    Scenario: The log is a new array only after it changed
      Given alice's room is synced with bob's moves along x to 1
      Then reading the log twice gives the same array of 1 entry

    Scenario: A commit gives a new log and leaves the old one alone
      Given alice's room is synced with bob's moves along x to 1
      And the log is remembered
      When the server commits bob's move to 2, 0
      Then the log is a new array with sequence numbers 1 and 2
      And the remembered log still holds 1 entry

  Rule: The device keeps the log and the pending commands

    Scenario: Storage only grows, in batches, and holds no acknowledged command
      Given alice's room is synced with bob's moves along x to 1 and 2
      And alice has moved to 1, 1
      When the server commits alice's move 1 as predicted
      And the server commits bob's move to 3, 0
      And alice's device writes to storage
      Then storage holds sequence numbers 1, 2, 3 and 4
      And storage appended 4 entries in all and was reset 0 times
      And the stored queue is empty
      And 0 commands are pending

    Scenario: A room reopens from what the device stored
      Given the device stored bob's move to 1, 0
      And the device queued move "q1" to 4, 4
      When alice opens a cursor room
      Then the last sequence number is 1
      And bob's cursor shows at 1, 0
      And alice's cursor shows at 4, 4
      And the pending commands are "q1"

    Scenario: A stored log with a gap is wiped
      Given the device stored bob's move at sequence number 5 and nothing before it
      When alice opens a cursor room
      Then the last sequence number is 0
      And storage was reset 1 time

  Rule: A client re-syncs when its log cannot be trusted

    Scenario: A welcome behind the device's log wipes it and re-syncs
      Given alice's room is synced with bob's moves along x to 1 and 2
      When a welcome ending at sequence number 1 arrives
      And alice's device writes to storage
      Then the last sequence number is 0
      And alice's device has asked to sync from sequence number 0
      And storage was reset 1 time and holds no entries

    Scenario: A gap in the committed stream re-syncs from the device's tip
      Given alice's room is synced with bob's moves along x to 1
      When the server commits bob's move at sequence number 3
      Then the room is not synced
      And alice's device has asked to sync from sequence number 1
