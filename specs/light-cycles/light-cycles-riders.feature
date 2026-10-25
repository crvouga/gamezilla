@domain:light-cycles
Feature: Take a rider or watch
  When people play Light Cycles together, each wants their own rider, a fair start and the same arena as everyone else, so the only thing that decides a round is how they ride.

  Rule: Each mode starts once with its fixed riders, each on its own starting cell

    Scenario Outline: Each mode starts with its riders in seat order
      Given Alice has a Light Cycles <mode> custom game with every rider ready
      When Alice starts the custom game
      Then the first round counts down with <riders>

      Examples:
        | mode | riders                      |
        | Duel | Comet and Ember             |
        | Trio | Comet, Ember and Nova       |
        | Quad | Comet, Ember, Nova and Volt |

    Scenario Outline: Each rider has its own starting cell and direction
      Given Alice has a Light Cycles Quad custom game with every rider ready
      When Alice starts the custom game
      Then <rider> waits at column <column>, row <row> heading <direction>

      Examples:
        | rider | column | row | direction |
        | Comet | 10     | 7   | right     |
        | Ember | 31     | 22  | left      |
        | Nova  | 31     | 7   | down      |
        | Volt  | 10     | 22  | up        |

    Scenario Outline: Starting a custom game again changes nothing
      Given the Light Cycles game is <stage>
      When Alice starts the custom game
      Then the Light Cycles game is still <stage>

      Examples:
        | stage      |
        | under way  |
        | finished   |
        | called off |

  Rule: In each new round, every rider sets off from the next rider's starting cell in seat order
    No counter-example: the starting cells never depend on chance or on who won.

    Scenario Outline: Comet's starting cell passes to the next rider's each round
      Given round <ended> of a Light Cycles <mode> game has just ended
      When 2 seconds pass
      Then Comet waits at column <column>, row <row> heading <direction>

      Examples:
        | mode | ended | column | row | direction |
        | Duel | 1     | 31     | 22  | left      |
        | Duel | 2     | 10     | 7   | right     |
        | Trio | 2     | 31     | 7   | down      |
        | Trio | 3     | 10     | 7   | right     |
        | Quad | 3     | 10     | 22  | up        |
        | Quad | 4     | 10     | 7   | right     |

  Rule: Only a rider's own person steers it

    Background:
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel watched by Carol and by Eve, a guest who is not signed in
      And Comet is at column 10, row 5 heading right

    Scenario: Alice steers her own rider
      When Alice steers Comet up
      Then Comet's next step is up

    Scenario Outline: Nobody else can steer Alice's rider
      When <person> steers Comet up
      Then <person> cannot steer Comet because it is Alice's rider
      And Comet's next step is still right

      Examples:
        | person |
        | Bob    |
        | Carol  |
        | Eve    |

  Rule: Watchers and people arriving during a round see the same game as the riders

    Background:
      Given Alice rides Comet, Bob rides Ember and Carol rides Nova in a Light Cycles Trio
      And the riders are riding in the second round with Comet on 1 round win

    Scenario: Someone arriving during a round sees the same arena as the riders
      When Dave joins Alice's space
      Then Dave sees the same arena, trails, riders, score, round and countdown as Alice

    Scenario: Someone arriving once every rider is taken only watches
      When Dave joins Alice's space
      Then Dave cannot steer any rider because every rider is taken

  Rule: A person whose rider crashed watches the rest of the round and rides again in the next round

    Background:
      Given Alice rides Comet, Bob rides Ember and Carol rides Nova in a Light Cycles Trio
      And Comet crashed in the second round while Ember and Nova are still riding

    Scenario: A crashed rider cannot be steered for the rest of the round
      When Alice steers Comet up
      Then Alice cannot steer Comet because it has crashed in this round
      And Alice sees the same arena, trails, riders, score, round and countdown as Bob

    Scenario: A crashed rider rides again in the next round
      Given the third round is counting down
      When the Light Cycles countdown ends
      Then Comet is riding
      And Alice can steer Comet
