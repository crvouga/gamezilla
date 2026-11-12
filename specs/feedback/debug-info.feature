@domain:feedback
Feature: Debug info on a bug report
  When a person reports a bug, the team wants to know what led up to it, so
  the team can reproduce the bug without asking the person anything.

  Rule: Every bug report carries the debug info kept before it was opened
    No counter-example: debug info is kept all the time, whether or not a bug is ever reported.

    Scenario: What the person did before reporting reaches the team
      Given Alice has opened Settings
      And Alice has described the bug as "Settings looks empty"
      When Alice sends the bug report
      Then the team's bug report from Alice shows that Alice opened Settings

    Scenario: Trouble the app ran into reaches the team
      Given Alice's app has run into trouble
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team's bug report from Alice shows the trouble the app ran into

    Scenario: The device and the version of the app reach the team
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice names Alice's device and the version of the app

  Rule: Debug info never holds what a person typed
    No counter-example: the description is the only writing a bug report carries.

    Scenario: Something typed before reporting stays off the bug report
      Given Alice has typed "a secret plan" in the app
      And Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice does not contain "a secret plan"

  Rule: Debug info covers the last 5 minutes
    No counter-example: older debug info is dropped, and nothing is refused.

    Scenario: Something done 4 minutes ago is in the debug info
      Given Alice opened Settings 4 minutes ago
      And Alice has described the bug as "Settings looks empty"
      When Alice sends the bug report
      Then the team's bug report from Alice shows that Alice opened Settings

    Scenario: Something done 6 minutes ago is not in the debug info
      Given Alice opened Settings 6 minutes ago
      And Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice does not show that Alice opened Settings

  Rule: A draft sent later carries the debug info from before it was first opened and from before it is sent
    No counter-example: what was done at any other time is not included, and nothing is refused.

    Scenario: Something done 4 minutes before a draft was first opened is in the debug info
      Given Alice opened Settings 4 minutes before opening a bug report
      And Alice has described the bug as "Settings looks empty"
      And Alice has come back to the draft after 60 minutes
      When Alice sends the bug report
      Then the team's bug report from Alice shows that Alice opened Settings

    Scenario: Something done 6 minutes before a draft was first opened is not in the debug info
      Given Alice opened Settings 6 minutes before opening a bug report
      And Alice has described the bug as "The board froze after a move"
      And Alice has come back to the draft after 60 minutes
      When Alice sends the bug report
      Then the team's bug report from Alice does not show that Alice opened Settings

    Scenario: Something done 4 minutes before a draft is sent is in the debug info
      Given Alice has described the bug as "Settings looks empty"
      And Alice has come back to the draft after 60 minutes
      And Alice opened Settings 4 minutes ago
      When Alice sends the bug report
      Then the team's bug report from Alice shows that Alice opened Settings

    Scenario: Something done while a draft waited is not in the debug info
      Given Alice has described the bug as "The board froze after a move"
      And Alice opened Settings 10 minutes later
      And Alice has come back to the draft after 60 minutes
      When Alice sends the bug report
      Then the team's bug report from Alice does not show that Alice opened Settings

  Rule: A person is told that debug info is sent
    No counter-example: a bug report never carries debug info without saying so.

    Scenario: An open bug report tells its person it includes debug info
      Given Alice's app is working
      When Alice chooses to report a bug
      Then Alice is told the bug report includes debug info and never what Alice typed
