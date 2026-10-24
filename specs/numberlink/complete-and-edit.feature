@domain:numberlink
Feature: Complete and edit Numberlink drawings
  When Alice changes a Numberlink drawing, she wants completion to follow the puzzle's chosen rule, so partial drawings never count as complete.

  Rule: Full-board coverage needs every pair connected and every cell covered

    Scenario: Connecting the last pair completes a covered board
      Given Alice has the Numberlink puzzle "Two rows"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice draws Numberlink pair "2" through "A2 B2 C2"
      Then Numberlink is complete

    Scenario: Uncovered cells keep connected pairs unfinished
      Given Alice has the Numberlink puzzle "Room below"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice draws Numberlink pair "2" through "A2 B2 C2"
      Then Numberlink is unfinished because cells remain uncovered

    Scenario: An incomplete pair keeps a covered drawing unfinished
      Given Alice has the Numberlink puzzle "Two rows"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice draws Numberlink pair "2" through "A2 B2"
      Then Numberlink is unfinished

  Rule: Endpoint-only coverage permits uncovered cells but still needs every pair connected

    Scenario: Connecting all pairs completes endpoint-only coverage
      Given Alice has the Numberlink puzzle "Endpoints only"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice draws Numberlink pair "2" through "A2 B2 C2"
      Then Numberlink is complete

    Scenario: Endpoint-only coverage still requires the last matching endpoint
      Given Alice has the Numberlink puzzle "Endpoints only"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice draws Numberlink pair "2" through "A2 B2"
      Then Numberlink is unfinished

  Rule: Editing or removing one path keeps the other paths
    No counter-example: invalid replacement paths are refused under the drawing rules.

    Background:
      Given Alice has the Numberlink puzzle "Two rows"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      And Alice has drawn Numberlink pair "2" through "A2 B2 C2"

    Scenario: Redrawing a connected pair replaces only its path
      When Alice draws Numberlink pair "1" through "C1 B1"
      Then Numberlink pair "1" has the path "C1 B1"
      And Numberlink pair "2" has the path "A2 B2 C2"
      And Numberlink is unfinished

    Scenario: Removing a path keeps the other connected pair
      When Alice removes Numberlink path "1"
      Then Numberlink pair "1" has no path
      And Numberlink pair "2" is connected

  Rule: Clearing the board keeps every endpoint and the chosen coverage
    No counter-example: clearing an already cleared board has the same outcome.

    Scenario: A cleared drawing is ready for another solution
      Given Alice has the Numberlink puzzle "Two rows"
      And Alice has drawn Numberlink pair "1" through "A1 B1 C1"
      When Alice clears the Numberlink board
      Then every Numberlink path is removed
      And the Numberlink endpoints and coverage are unchanged
