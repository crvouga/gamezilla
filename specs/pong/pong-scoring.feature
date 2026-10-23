@domain:pong
Feature: Score points and finish Pong
  When Alice and Bob play Pong, they want the same score and a clear winner,
  so each point counts toward finishing their game.

  Background:
    Given Alice and Bob have a Pong game on one device with Alice at the left paddle

  Rule: A countdown ends with a serve and no point is awarded
    No counter-example: the countdown itself never awards a point.

    Scenario: The first serve begins with both scores at zero
      Given Pong is counting down for the first serve
      When the Pong countdown ends
      Then the ball is in play
      And the Pong score is still 0 to 0

  Rule: A ball passing a paddle awards one point to the other person
    No counter-example: passing a paddle always awards the point to the other person.

    Scenario Outline: The person who returns the ball past the other paddle wins the point
      Given Pong is in play with a target score of 2
      When the ball passes the <paddle> paddle
      Then <person> has 1 Pong point
      And Pong is counting down for the next serve

      Examples:
        | paddle | person |
        | right  | Alice  |
        | left   | Bob    |

  Rule: The target score finishes Pong and its score never changes afterwards

    Scenario: The final point awards the victory
      Given Alice has 1 Pong point and Bob has 0 with a target score of 2
      When the ball passes the right paddle
      Then Alice wins Pong
      And the Pong ball has stopped

    Scenario: Time passing cannot add a point to a finished Pong game
      Given Alice has won Pong by 2 points to 0
      When 5 seconds pass
      Then the Pong score is still 2 to 0
      And the Pong ball has stopped

  Rule: Reopening local play keeps every point
    No counter-example: opening the app again never awards or removes a point.

    Scenario Outline: Reopening keeps local Pong as it was
      Given Pong is <stage> with a score of <left> to <right> and a target score of 2
      When Alice closes and reopens the app
      Then the Pong score is still <left> to <right>
      And Pong is <stage>

      Examples:
        | stage         | left | right |
        | counting down | 0    | 0     |
        | in play       | 1    | 0     |
        | finished      | 2    | 0     |
