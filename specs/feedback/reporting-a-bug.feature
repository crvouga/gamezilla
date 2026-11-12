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

  Rule: A description holds at most 4,000 characters

    Scenario: A description of 3,999 characters has room for more
      Given Alice has opened a bug report
      When Alice describes the bug in 3999 characters
      Then Alice's description has 3999 characters
      And Alice is not told the description is full

    Scenario: A description of 4,000 characters is kept whole
      Given Alice has opened a bug report
      When Alice describes the bug in 4000 characters
      Then Alice's description has 4000 characters
      And Alice is told the description is full at 4,000 characters

    Scenario: Writing past 4,000 characters adds nothing
      Given Alice has described the bug in 4000 characters
      When Alice adds to the description
      Then Alice is told the description is full at 4,000 characters
      And Alice's description has 4000 characters

  Rule: A guest can report a bug
    No counter-example: reporting a bug never depends on signing in.

    Scenario: A guest's bug report reaches the team
      Given Alice is a guest
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team has a bug report from Alice saying "The hint never appeared"

  Rule: A bug report tells the team who sent it
    No counter-example: every bug report says who sent it, and nothing a person does is refused.

    Scenario: A signed-in person's bug report names their account
      Given Alice is signed in
      And Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice names Alice's account

    Scenario: A guest's bug report says it came from a guest
      Given Alice is a guest
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team's bug report from Alice says it came from a guest

  Rule: An unsent bug report is kept as a draft
    No counter-example: a draft is kept until its person sends it or discards it.

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

    Scenario: Reopening the app keeps the draft's screenshots
      Given Alice has a bug report with 3 screenshots
      And Alice has reopened the app
      When Alice chooses to report a bug
      Then Alice's bug report has 3 screenshots

    Scenario: A bug report the team has is no longer a draft
      Given Alice has sent a bug report saying "The board froze after a move"
      When Alice chooses to report a bug
      Then Alice's bug report has no description

  Rule: A person can discard a draft
    No counter-example: discarding a draft is the person's own choice and is never refused.

    Background:
      Given Alice has a bug report with 3 screenshots
      And Alice has described the bug as "The board froze after a move"

    Scenario: Discarding a draft keeps it from the team
      When Alice discards the draft
      Then Alice has no draft
      And the team has no bug report from Alice

    Scenario: A discarded draft does not come back
      Given Alice has discarded the draft
      And Alice has reopened the app
      When Alice chooses to report a bug
      Then Alice's bug report has no description
      And Alice's bug report has 1 screenshot
