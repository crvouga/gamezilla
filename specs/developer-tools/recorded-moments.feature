@domain:developer-tools
Feature: Read what a test run recorded
  When the team investigates a test run, the team wants to see what happened
  at each recorded moment, so they can explain an outcome from captured evidence.

  Rule: Opening a test report starts at its first failure or its final recorded moment
    No counter-example: the starting moment is the first failure if one exists, and otherwise the final recorded moment.

    Scenario: A failed test report opens at its first failed step's recorded moment
      Given a test report has several failed steps with recorded moments
      When the team opens that test report
      Then the team sees the first failed step's first recorded moment

    Scenario: A passing test report opens at its final recorded moment
      Given a passing test report has several recorded moments
      When the team opens that test report
      Then the team sees its final recorded moment

  Rule: Each person's picture is from the selected recorded moment or an earlier one

    Scenario: A current picture shows what the person saw at that moment
      Given a test report has Alice's picture at the second recorded moment
      When the team selects the second recorded moment
      Then the team sees Alice's picture from the second recorded moment

    Scenario: An earlier picture is marked as earlier and never replaced by a future one
      Given a test report has Bob's pictures only at its first and third recorded moments
      When the team selects the second recorded moment
      Then the team sees Bob's first picture marked as earlier
      And Bob's third picture cannot appear because it was recorded later

  Rule: A missing picture never becomes a guessed picture

    Scenario: A recorded moment without pictures still shows its recorded observations
      Given a recorded moment has observations but no person's picture
      When the team selects that recorded moment
      Then the team sees the observations recorded at that moment

    Scenario: A person with no earlier picture has no invented picture
      Given Bob's first picture was captured after the selected recorded moment
      When the team shows Bob at the selected recorded moment
      Then Bob's picture is not offered because none was recorded by that moment

  Rule: A recorded action highlights only the control it actually recorded

    Scenario: The recorded control is highlighted in the person's picture
      Given a recorded moment names a control present in Alice's picture
      When the team shows the recorded action in that moment
      Then the team sees that control highlighted in Alice's picture

    Scenario: An absent recorded control is reported as missing
      Given a recorded moment names a control absent from Alice's picture
      When the team shows the recorded action in that moment
      Then the team is told the recorded control cannot be found in that picture
