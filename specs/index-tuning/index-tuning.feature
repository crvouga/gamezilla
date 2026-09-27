@domain:index-tuning
Feature: Index tuning
  When the team declares the lookups the product makes, the team wants each
  lookup to get the index it needs without tuning anything by hand, and wants
  indexes nothing needs any more cleared away without ever losing one that is
  still used or one the team keeps itself.

  Rule: Every declared lookup gets a tuned index

    Scenario: A declared lookup gets a tuned index when tuning runs
      Given the team declares the notes-by-author lookup
      When tuning runs
      Then the notes-by-author lookup has a tuned index

    Scenario: Tuning again with nothing new to do changes nothing
      Given the team declares the notes-by-author lookup
      And tuning has run
      When tuning runs
      Then tuning changes nothing

  Rule: A tuned index no declared lookup needs retires before it is removed

    Scenario: A tuned index no declared lookup needs starts retiring and stays
      Given the notes-by-author lookup has a tuned index
      And the team no longer declares any lookup
      When tuning runs
      Then the notes-by-author index is retiring
      And the notes-by-author index is still there

    Scenario: An unused retiring index is removed once its retirement window has passed
      Given the notes-by-author index is retiring
      And the retirement window has passed
      When tuning runs
      Then the notes-by-author index is gone

    Scenario: Declaring a lookup again stops its index retiring
      Given the notes-by-author index is retiring
      And the team declares the notes-by-author lookup
      When tuning runs
      Then the notes-by-author index is not retiring

  Rule: A retiring index that is still used is kept

    Scenario: A retiring index used during its retirement window is kept
      Given the notes-by-author index is retiring
      And the notes-by-author index has been used since it began retiring
      And the retirement window has passed
      When tuning runs
      Then the notes-by-author index is still there

  Rule: Tuning never touches the team's own index

    Scenario: The team's own index outlasts any retirement window unused
      Given the team keeps its own index
      And the team no longer declares any lookup
      And 40 days have passed
      When tuning runs
      Then the team's own index is still there
