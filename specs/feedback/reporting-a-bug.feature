@domain:feedback
Feature: Report a bug
  When the app does something a person did not expect, the person wants to
  tell the team what happened, so the bug gets fixed without anyone asking
  the person to explain it again.

  Rule: A bug report with a description reaches the team

    Scenario: A described bug reaches the team
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then Alice is told the team has the bug report
      And the team has a bug report from Alice saying "The board froze after a move"

    Scenario: A bug report without a description is refused
      Given Alice has opened a bug report
      When Alice sends the bug report
      Then Alice is told to describe the bug before sending
      And the team has no bug report from Alice

  Rule: A guest can report a bug
    No counter-example: reporting a bug never depends on signing in.

    Scenario: A guest's bug report reaches the team
      Given Alice is a guest
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team has a bug report from Alice saying "The hint never appeared"

  Rule: An unsent bug report is kept as a draft
    No counter-example: a draft is kept until its bug report is sent.

    Scenario: Closing a bug report keeps its description
      Given Alice has described the bug as "The board froze after a move"
      And Alice has closed the bug report
      When Alice chooses to report a bug
      Then Alice's bug report says "The board froze after a move"

    Scenario: Reopening the app keeps the draft
      Given Alice has described the bug as "The board froze after a move"
      And Alice has reopened the app
      When Alice chooses to report a bug
      Then Alice's bug report says "The board froze after a move"

    Scenario: A bug report the team has is no longer a draft
      Given Alice has sent a bug report saying "The board froze after a move"
      When Alice chooses to report a bug
      Then Alice's bug report has no description
