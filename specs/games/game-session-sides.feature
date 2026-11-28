@domain:games
Feature: Choose each side of a game session
  When setting up a game session, its creator wants to choose who plays each side, so the same game session fits people, bots and open sides.

  Rule: The creator changes the participants only before the game session starts

    Scenario: A bot replaces an open side
      Given Alice is setting up a game session
      When Alice assigns a bot to the second side
      Then the second side is a bot

    Scenario: Starting freezes the participants
      Given Alice and Bob have a game session under way
      When Alice assigns a bot to the second side
      Then Alice is told the game session has already started

  Rule: Opening a side removes its earlier choice before the game session starts

    Scenario: Opening a bot's side makes it available to a person
      Given Alice is setting up a game session
      And Alice has assigned a bot to the second side
      When Alice opens the second side
      Then the second side is open

    Scenario: A side cannot be opened once the game session is under way
      Given Alice and Bob have a game session under way
      When Alice opens the second side
      Then Alice is told the game session has already started

  Rule: One person takes at most one side

    Scenario: The creator takes the second side instead of the first
      Given Alice is setting up a game session
      And Alice has opened the first side
      When Alice takes the second side
      Then the second side is Alice

    Scenario: The creator cannot take both sides
      Given Alice is setting up a game session
      When Alice takes the second side
      Then Alice is told a person cannot take both sides

  Rule: The creator may watch two other participants

    Scenario: Two bots start under a watching creator
      Given Alice is setting up a game session
      And Alice has assigned bots to both sides
      When Alice starts the game session
      Then Alice is watching the game session
      And both sides are bots in the game session under way

    Scenario: Watching does not let the creator move for a bot
      Given Alice has a game session under way between two bots
      When Alice makes a move
      Then Alice is told it is the other player's turn

  Rule: Swapping the sides requires people to become ready again

    Scenario: The creator swaps accepted people
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice swaps the sides
      Then the first side is Bob and the second side is Alice
      And neither person is ready for the game session

    Scenario: Sides cannot swap once the game session is under way
      Given Alice and Bob have a game session under way
      When Alice swaps the sides
      Then Alice is told the game session has already started

  Rule: A closed side cannot be claimed

    Scenario: The creator closes an unoccupied side
      Given Alice is setting up a game session
      When Alice closes the second side
      Then the second side is closed

    Scenario: A closed side refuses another person
      Given Alice is setting up a game session
      And Alice has closed the second side
      When Bob claims the second side
      Then Bob is told that side is not open

  Rule: Each participant sees their own side nearest them, and everyone else sees the first side nearest
    No counter-example: nobody chooses where the sides sit; it follows the side each person has taken.

    Scenario: Each participant sees their own side nearest when the game session starts
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice starts the game session
      Then Bob sees the second side nearest him
      And Alice sees the first side nearest her

    Scenario: A watcher sees the first side nearest
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      And Carol is in Alice's space
      When Alice starts the game session
      Then Carol sees the first side nearest her

    Scenario: A creator watching two bots sees the first side nearest
      Given Alice is setting up a game session
      And Alice has assigned bots to both sides
      When Alice starts the game session
      Then Alice sees the first side nearest her

    Scenario: Swapping the sides puts each person's new side nearest them
      Given Alice is setting up a game session with Bob on the second side
      And Alice has swapped the sides
      And Alice and Bob are ready for the game session
      When Alice starts the game session
      Then Alice sees the second side nearest her
      And Bob sees the first side nearest him
