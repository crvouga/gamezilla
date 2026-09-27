Feature: Room server
  The room server is a room's authority. It checks each command against the
  room module, commits the events to the room's log in order, and sends each
  commit to every connection. A command id it has seen before is answered
  from memory, never applied again, and a server rebuilt from storage carries
  on where the last one stopped.

  Rule: Commits reach every connection

    Scenario: A commit reaches everyone as one shared frame
      Given a cursor room server with alice and bob connected
      When alice sends move command "c1"
      And bob sends move command "c2"
      Then alice and bob each received 2 committed frames
      And alice and bob received the same first committed frame
      And the log holds sequence numbers 1 and 2
      And the committed state counts 2 moves

    Scenario: The server keeps its log tip in memory
      Given a cursor room server with alice and bob connected
      When alice sends move command "c1"
      And bob sends move command "c2"
      Then the server has not read its log tip since it started

  Rule: A command id applies once

    Scenario: A resent command id replays the first outcome
      Given a cursor room server with alice connected
      When alice sends move command "dup"
      And alice sends move command "dup"
      Then the log holds 1 entry
      And alice received 2 committed frames
      And alice's last committed frame carries sequence number 1

    Scenario: A command the scheduler injects twice applies once, as the scheduler
      Given a cursor room server with alice connected
      When the scheduler injects move command "i1"
      And the scheduler injects move command "i1"
      Then the log holds 1 entry
      And entry 1 was made by the scheduler
      And alice received 1 committed frame

  Rule: Invalid commands are refused

    Scenario: Invalid commands are refused and the refusal remembered
      Given a cursor room server with alice connected
      When alice sends command "bad" whose payload is not a message
      And alice sends command "unknown" of unknown type "cursor-cmd/teleport"
      Then alice received 2 invalid-command refusals
      And the server remembers command "bad" as refused
      And the log holds 0 entries

  Rule: Connections are answered

    Scenario: A ping is answered with a pong
      Given a cursor room server with alice connected
      When alice pings
      Then alice's last frame is a pong

    Scenario: A sync from the start sends a capped welcome, then the roster
      Given a cursor room server with alice connected
      And alice has committed 5 more moves than one welcome holds
      When alice asks to sync from sequence number 0
      Then alice receives a full welcome saying the log runs 5 entries further
      And alice then receives the roster

  Rule: The server survives a restart

    Scenario: A restarted server rebuilds its state from storage
      Given a cursor room server with alice connected
      And alice has sent move command "c1"
      When the server restarts from the same storage
      Then the committed state counts 1 move

    Scenario: A restarted server continues the log where it stopped
      Given a cursor room server with alice connected
      And alice has sent move command "c1"
      And the server has restarted from the same storage
      When bob connects
      And bob sends move command "c2"
      Then the log holds sequence numbers 1 and 2

  Rule: The roster lists who is connected

    Scenario: A connection joins the roster
      Given an empty cursor room server
      When bob connects
      Then the roster lists bob

    Scenario: A closed connection leaves the roster
      Given a cursor room server with bob connected
      When bob's connection closes
      Then the roster is empty
      And bob received 1 roster frame
