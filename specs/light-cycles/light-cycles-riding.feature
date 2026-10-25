@domain:light-cycles
Feature: Ride and steer a rider
  When Alice rides in Light Cycles, she wants her rider to go steadily and to turn exactly when she steers, so she can avoid every crash she sees coming.

  Background:
    Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel

  Rule: Every riding rider moves one cell each step, straight ahead unless it turned
    No counter-example: a riding rider never stops, goes diagonally or skips a cell; only a crash stops it.

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: A rider that nobody steered moves one cell straight ahead
      When the riders take their next step
      Then Comet is at column 11, row 5 heading right

    Scenario: Riders cover 10 cells every second
      When 2 seconds pass
      Then Comet is at column 30, row 5 heading right

  Rule: A turn takes effect on the rider's next step, and a turn straight back is ignored

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: Steering a rider to one side turns it on its next step
      When Alice steers Comet up
      Then Comet's next step is up

    Scenario: Steering a rider straight back is ignored
      When Alice steers Comet left
      Then Comet's next step is still right

  Rule: Two quick turns take effect one step after the other

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: Two quick turns make a tight turn over two steps
      Given Alice has quickly steered Comet up and then left
      When the riders take their next step
      Then Comet is at column 10, row 4 heading up
      And Comet's next step is left

    Scenario: A quick turn straight back against the turn just chosen is ignored
      Given Alice has quickly steered Comet up
      When Alice steers Comet down
      Then Comet's next step is still up

  Rule: A person steers only while a round counts down or rides

    Scenario: A turn chosen during the countdown takes effect on the round's first step
      Given the second round is counting down with Comet on its starting cell at column 31, row 22 heading left
      When Alice steers Comet up
      Then Comet's next step is up

    Scenario: Steering while the round result shows is refused
      Given Comet won the first round and its round result is showing
      When Alice steers Comet up
      Then Alice cannot steer Comet because the round result is showing

    Scenario: Steering before the custom game starts is refused
      Given the custom game has not started
      When Alice steers Comet up
      Then Alice cannot steer Comet because the custom game has not started

  Rule: A turn never carries into another round
    No counter-example: every round begins with each rider heading in its starting direction.

    Scenario: A turn chosen as a round ends never carries into the next round
      Given Alice had steered Comet up when the first round ended
      And the second round is counting down
      When the Light Cycles countdown ends
      Then Comet's next step is still left

  Rule: A person steers with the keyboard or with the direction pad
    No counter-example: each way of steering turns the same rider by the same rules.

    Background:
      Given Comet is at column 10, row 5 heading right

    Scenario: The keyboard's arrows steer the rider
      When Alice steers Comet up with the keyboard's up arrow
      Then Comet's next step is up

    Scenario: The keyboard's W, A, S and D steer the rider
      When Alice steers Comet up with the keyboard's W
      Then Comet's next step is up

    Scenario: The direction pad steers the rider on a phone
      When Alice steers Comet up with the direction pad on her phone
      Then Comet's next step is up
