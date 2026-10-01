@domain:profile @synthetic
Feature: Finding a person's trouble
  When someone runs into trouble, the team wants to find what happened from
  the person's name, where they were, and the time on their clock, so they
  can put it right.

  Rule: The team finds what happened from the name, the place, and the time on the clock

    Background:
      Given "Alice" ran into trouble in "Gilbert, Arizona" at "6:33 in the evening Mountain time"

    Scenario: The team finds Alice's trouble in Gilbert in the evening
      When the team follows the trail for "Alice" in "Gilbert, Arizona" at "6:33 in the evening Mountain time"
      Then the team sees what went wrong for "Alice"

    Scenario: A morning lookup does not show Alice's evening trouble
      When the team follows the trail for "Alice" in "Gilbert, Arizona" at "9:00 in the morning Mountain time"
      Then the team is told nothing happened for "Alice" at that time

  Rule: The place a connection appeared can differ from the time on the person's clock
    No counter-example: another place still finds the same trouble; the team is not refused.

    Scenario: The team finds Alice when her connection appeared in Las Vegas
      Given "Alice" ran into trouble in "Las Vegas" at "6:33 in the evening Mountain time"
      When the team follows the trail for "Alice" in "Las Vegas" at "6:33 in the evening Mountain time"
      Then the team sees what went wrong for "Alice"
