@domain:games
Feature: A matched game follows the account
  When a person changes their account or leaves a space, they want their matched game kept honestly, so it belongs to their account alone.

  Rule: Signing out on one device does not stop the account's search, and the signed-out device can no longer play for the account

    Scenario: Another signed-in device keeps the search
      Given Alice signed out on her phone while seeking an opponent for the game
      When Alice opens finding an opponent on another device
      Then Alice sees her same search on that device

    Scenario: A signed-out device cannot go on with the account's matched game
      Given Alice signed out on her phone during her matched game with Bob
      And Alice is hosting a space
      When Alice seeks an opponent for the game at 5+0
      Then Alice is invited to sign in
      And Alice cannot see the account's matched game on her phone

  Rule: The opponent is shown by their current username
    No counter-example: changing a username changes the name shown, never the matched person or game.

    Scenario: Renaming changes the opponent's username without replacing the matched game
      Given Alice renamed herself to @alice_atlas during her matched game with Bob
      When Bob opens finding an opponent
      Then Bob sees his opponent's username is @alice_atlas
      And Bob keeps his matched game with Alice

  Rule: Spaces and friendships do not own the matched game
    No counter-example: changing a space or a friendship never makes a move, resigns or deletes an account.

    Scenario: Returning in another space keeps the person's matched game
      Given Alice ended her space during her matched game with Bob
      And Alice is hosting another space
      When Alice opens finding an opponent
      Then Alice keeps her matched game with Bob

    Scenario: Removing a friend keeps the matched game
      Given Alice removed Bob from her friends list during their matched game
      When Bob opens finding an opponent
      Then Bob keeps his matched game with Alice

  Rule: Confirmed account deletion stops the account's search, aborts a matched game not yet begun and otherwise gives up its unfinished matched game

    Scenario: Deleting an account removes its search
      Given Alice is seeking an opponent for the game
      When Alice confirms account deletion
      Then Alice is not waiting for an opponent
      And Bob cannot be paired with Alice's deleted account

    Scenario: Deleting an account before both first moves aborts the matched game
      Given Alice has the first side against Bob in a new 5+0 matched game
      When Alice confirms account deletion
      Then Bob sees the matched game was aborted
      And neither person's blitz rating has changed

    Scenario: Deleting an account keeps the other person's result
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice confirms account deletion
      Then Bob sees he won the matched game
      And Bob is not shown Alice's deleted personal details
