@domain:light-cycles
Feature: Keep riding when someone loses the connection
  When a rider's person loses the connection, everyone else wants the arena to keep going and the away person's rider to crash fairly, so one missing person never stops or decides a round for the others.

  Background:
    Given Alice rides Comet, Bob rides Ember and Carol rides Nova in a Light Cycles Trio on their own devices

  Rule: The arena keeps going for everyone while a person is away, and their rider keeps going straight

    Background:
      Given Comet is at column 5, row 14 heading right

    Scenario: The riders keep going when Alice loses the connection
      When Alice loses the connection
      Then Bob and Carol see Comet go on heading right
      And Bob and Carol can steer their own riders

    Scenario: An away person cannot steer their rider
      Given Alice is away
      When Alice steers Comet up
      Then Alice cannot steer Comet while she is away
      And Comet's next step is still right

  Rule: A rider whose person has been away for 3 seconds crashes for the rest of the round

    Background:
      Given Comet is at column 5, row 14 heading right
      And Alice is away

    Scenario: A rider whose person is away for 2 seconds is still riding
      When 2 seconds pass
      Then Comet is at column 25, row 14 heading right

    Scenario: A rider whose person is away for 3 seconds crashes
      When 3 seconds pass
      Then Comet has crashed
      And Ember and Nova are still riding

    Scenario: The crash of an away person's rider can end the round
      Given Ember has crashed in this round
      When 3 seconds pass
      Then everyone sees Nova won the round

  Rule: While a person stays away, their rider sits out every round that begins
    No counter-example: nobody steers the rider of a person who is away; coming back, in the next rule, is what ends sitting out.

    Scenario: A rider sits out the next round while its person is still away
      Given Alice has stayed away since Comet crashed in the second round
      And the second round has just ended
      When 2 seconds pass
      Then Comet sits out the third round on its starting cell
      And Ember and Nova are on their starting cells

    Scenario: A round with one rider left after the others sit out is won when its countdown ends
      Given Alice and Bob have stayed away since the second round
      And the third round is counting down
      When the Light Cycles countdown ends
      Then everyone sees Nova won the round

  Rule: A person who comes back rides again from the next round, and coming back changes nothing in the current round

    Scenario: Coming back during the round does not bring back a crashed rider
      Given Alice has stayed away since Comet crashed in the second round
      When Alice's connection comes back
      Then Comet is still crashed in the second round with its trail on the arena
      And every rider's round wins are unchanged

    Scenario: A person who came back rides again in the next round
      Given Alice came back after being away in the second round, before the third round began
      And the third round is counting down
      When the Light Cycles countdown ends
      Then Comet is riding
      And Alice can steer Comet

    Scenario: Coming back within 3 seconds keeps the rider riding
      Given Comet is at column 5, row 14 heading right
      And Alice has been away for 2 seconds
      When Alice's connection comes back
      Then Comet is riding
      And Alice can steer Comet

  Rule: A rider is steered from one device only

    Background:
      Given Alice is also signed in on another device

    Scenario: The device a person switches to steers their rider
      When Alice switches devices
      Then Alice can steer Comet from her other device

    Scenario: The device a person left cannot steer their rider
      Given Alice has switched devices
      When Alice steers Comet up from her first device
      Then Alice cannot steer Comet from her first device because she rides from her other device

    Scenario: Switching back gives steering back to the first device
      Given Alice has switched devices
      When Alice switches devices
      Then Alice can steer Comet from her first device

  Rule: When every person riding has been away for 30 seconds, the game is called off with no winner

    Background:
      Given Comet has 1 round win and Ember has 0
      And Alice, Bob and Carol are all away

    Scenario: A watcher sees the game called off when everyone riding has been away for 30 seconds
      Given Dave is watching the Light Cycles game in Alice's space with a connection
      When 30 seconds pass
      Then Dave sees the Light Cycles game is called off with no winner
      And Dave sees Comet has 1 round win and Ember has 0

    Scenario: A watcher sees the game still going when everyone riding has been away for 29 seconds
      Given Dave is watching the Light Cycles game in Alice's space with a connection
      When 29 seconds pass
      Then Dave sees the Light Cycles game is still unfinished

    Scenario: Nobody steers in a called-off game
      Given the Light Cycles game is called off
      And Alice's connection has come back
      When Alice steers Comet up
      Then Alice cannot steer Comet because the Light Cycles game is called off
