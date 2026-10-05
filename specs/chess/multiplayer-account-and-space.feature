@domain:chess
Feature: Multiplayer chess follows the account across other changes
  When a person changes their account or leaves a space, they want their
  game kept honestly, so its ownership follows the account.

  Rule: Signing out on one device does not stop the account's accepted search

    Scenario: Another signed-in device keeps the opponent search
      Given Alice signed out on her phone while looking for a chess opponent
      When Alice opens multiplayer chess on another signed-in device
      Then Alice is looking for her same chess opponent

    Scenario: A signed-out device cannot continue account-only play
      Given Alice signed out on her phone during a multiplayer game with Bob
      When Alice finds a chess opponent on her phone
      Then Alice is invited to sign in
      And Alice cannot see the account's multiplayer game on her phone

  Rule: A multiplayer opponent's current username is shown
    No counter-example: changing a username changes the name shown, never the matched person or game.

    Scenario: Renaming updates the opponent's name without replacing the game
      Given Alice renamed herself to "alice_atlas" during her multiplayer game with Bob
      When Bob opens multiplayer chess
      Then Bob sees his opponent's username is "alice_atlas"
      And Bob keeps his same multiplayer game with Alice

  Rule: Spaces and friendships do not own the multiplayer game
    No counter-example: space and friendship changes never express a move, resignation or account deletion.

    Scenario: Returning in another space keeps the person's multiplayer game
      Given Alice ended her space while playing multiplayer chess with Bob
      And Alice is hosting another space
      When Alice opens multiplayer chess
      Then Alice keeps her same multiplayer game with Bob

    Scenario: Removing a friend keeps the accepted game
      Given Alice removed Bob from her friends list during their multiplayer game
      When Bob opens multiplayer chess
      Then Bob keeps his same multiplayer game with Alice
