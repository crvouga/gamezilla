@domain:numberlink
Feature: Draw Numberlink paths
  When Alice plays Numberlink, she wants clear and fair path rules, so every connected pair obeys the same rules.

  Rule: A path starts at either matching endpoint and joins neighboring cells horizontally or vertically

    Background:
      Given Alice has the Numberlink puzzle "Two rows"

    Scenario: A continuous path connects its matching pair
      When Alice draws Numberlink pair "1" through "A1 B1 C1"
      Then Numberlink pair "1" is connected

    Scenario: A path may start at the other endpoint
      When Alice draws Numberlink pair "1" through "C1 B1 A1"
      Then Numberlink pair "1" is connected

    Scenario: A path cannot start between endpoints
      When Alice draws Numberlink pair "1" through "B1 C1"
      Then Alice is told to start the Numberlink path at a matching endpoint
      And the Numberlink paths are unchanged

    Scenario: A path cannot jump over a cell
      When Alice draws Numberlink pair "1" through "A1 C1"
      Then Alice is told to join neighboring Numberlink cells horizontally or vertically
      And the Numberlink paths are unchanged

    Scenario: A path cannot step diagonally
      When Alice draws Numberlink pair "1" through "A1 B2"
      Then Alice is told to join neighboring Numberlink cells horizontally or vertically
      And the Numberlink paths are unchanged

  Rule: A path never revisits a cell, overlaps another path, or passes another pair's endpoint

    Scenario: A path can stop before reaching its matching endpoint
      Given Alice has the Numberlink puzzle "Two rows"
      When Alice draws Numberlink pair "1" through "A1 B1"
      Then Numberlink pair "1" has the path "A1 B1"
      And Numberlink is unfinished

    Scenario: A path cannot revisit its own cell
      Given Alice has the Numberlink puzzle "Two rows"
      When Alice draws Numberlink pair "1" through "A1 B1 A1"
      Then Alice is told Numberlink paths cannot cross or overlap
      And the Numberlink paths are unchanged

    Scenario: Another pair's endpoint refuses a path
      Given Alice has the Numberlink puzzle "Two rows"
      When Alice draws Numberlink pair "1" through "A1 A2"
      Then Alice is told that Numberlink endpoint belongs to another pair
      And the Numberlink paths are unchanged

    Scenario: A path cannot cross another path between endpoints
      Given Alice has the Numberlink puzzle "Crossing"
      And Alice has drawn Numberlink pair "1" through "A2 B2 C2"
      When Alice draws Numberlink pair "2" through "B1 B2 B3"
      Then Alice is told Numberlink paths cannot cross or overlap
      And the Numberlink paths are unchanged

  Rule: Reaching the matching endpoint ends a path

    Scenario: A path ends exactly at its matching endpoint
      Given Alice has the Numberlink puzzle "Two rows"
      When Alice draws Numberlink pair "1" through "A1 B1 C1"
      Then Numberlink pair "1" has the path "A1 B1 C1"

    Scenario: A path cannot continue beyond its matching endpoint
      Given Alice has the Numberlink puzzle "Two rows"
      When Alice draws Numberlink pair "1" through "A1 B1 C1 C2"
      Then Alice is told to stop the Numberlink path at its matching endpoint
      And the Numberlink paths are unchanged
