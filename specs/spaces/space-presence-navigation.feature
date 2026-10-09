@domain:spaces
Feature: Look at the people in a space
  When people are in a space, they want to view its presence and return to
  what they were doing, so they can see who is with them without leaving.

  Rule: Presence counts only people currently in the space
    No counter-example: presence reports who is there; people cannot choose to keep someone showing after disconnection.

    Scenario: A host views the people in their space
      Given Alice is hosting a space that Bob joined from the link
      When Alice views the space's presence
      Then Alice sees 2 people in the space's presence

    Scenario: An offline host views their own presence
      Given Alice is hosting a space
      And Alice is offline
      When Alice views the space's presence
      Then Alice sees 1 person in the space's presence

    Scenario: A friend sees nobody present while the host is offline
      Given Alice is hosting a space that Bob joined from the link
      And Alice is offline
      When Bob views the space's presence
      Then Bob sees 0 people in the space's presence

  Rule: Closing presence leaves the person in the space
    No counter-example: stopping viewing presence changes only what the person is looking at.

    Scenario: A host returns from presence to their space
      Given Alice is hosting a space
      And Alice is viewing the space's presence
      When Alice stops viewing the space's presence
      Then Alice is in the space
      And Alice no longer sees the space's presence

    Scenario: An offline host returns from presence to their space
      Given Alice is hosting a space
      And Alice is offline
      And Alice is viewing the space's presence
      When Alice stops viewing the space's presence
      Then Alice is in the space
      And Alice no longer sees the space's presence

  Rule: Ending a space closes its presence view
    No counter-example: an ended space has nobody present; the view ends with it.

    Scenario: A friend viewing presence sees the space end
      Given Alice is hosting a space that Bob joined from the link
      And Bob is viewing the space's presence
      When Alice ends the space
      Then Bob sees the space has ended within 20 seconds
      And Bob no longer sees the space's presence

  Rule: People can return to the lobby after leaving or ending a space
    No counter-example: going back to the lobby is available after either outcome.

    Scenario: A host returns to the lobby after ending their space
      Given Alice is hosting a space
      And Alice has ended the space
      When Alice goes back to the lobby
      Then Alice is back in the lobby

    Scenario: A friend returns to the lobby after leaving a space
      Given Alice is hosting a space that Bob joined from the link
      And Bob has left the space
      When Bob goes back to the lobby
      Then Bob is back in the lobby
