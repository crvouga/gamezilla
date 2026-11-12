@domain:feedback
Feature: Report a bug about one thing on the screen
  When a person on a computer sees one thing on the screen that is wrong, the
  person wants to report a bug about that thing, so the team knows exactly
  which thing to fix without asking.

  Rule: A bug report about one thing tells the team which thing it is about

    Scenario: A bug report about Settings tells the team it is about Settings
      Given Alice has reported a bug about "Settings"
      And Alice has described the bug as "Settings does nothing"
      When Alice sends the bug report
      Then the team's bug report from Alice is about "Settings"

    Scenario: A bug report opened by choosing to report a bug is about nothing in particular
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice is about nothing in particular

  Rule: The screenshot marks the thing a bug report is about

    Scenario: Reporting a bug about Settings marks Settings on the screenshot
      Given Alice's app is working
      When Alice reports a bug about "Settings"
      Then Alice has one bug report open
      And the screenshot marks "Settings"

    Scenario: Choosing to report a bug marks nothing on the screenshot
      Given Alice's app is working
      When Alice chooses to report a bug
      Then the screenshot marks nothing

  Rule: Reporting a bug about one thing while a bug report is open keeps the same bug report
    No counter-example: a person has one bug report at a time, however it was opened.

    Scenario: Reporting a bug about Settings while a bug report is open keeps the same bug report
      Given Alice has described the bug as "The board froze after a move"
      When Alice reports a bug about "Settings"
      Then Alice has one bug report open
      And Alice's bug report says "The board froze after a move"

  Rule: A bug report about something a person types in never carries what they typed
    No counter-example: the description is the only writing a bug report carries.

    Scenario: A bug report about the note never carries what was typed in it
      Given Alice has typed "a secret plan" in the app
      And Alice has reported a bug about "Note"
      And Alice has described the bug as "The note forgets its words"
      When Alice sends the bug report
      Then the team's bug report from Alice does not contain "a secret plan"

  Rule: A bug report about one thing opens even when the app is unusable
    No counter-example: trouble in the app never takes away reporting a bug.

    Scenario: Reporting a bug about Report a bug on an app that has crashed opens a bug report
      Given Alice's app has crashed
      When Alice reports a bug about "Report a bug"
      Then Alice has one bug report open
