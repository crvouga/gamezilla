@domain:feedback
Feature: Keep a bug report until the team has it
  When a bug report cannot reach the team straight away, the person wants it
  kept and sent for them, so a bug never has to be reported twice.

  Rule: A bug report sent offline waits for the connection

    Scenario: A bug report sent offline is kept on the device
      Given Alice's device is offline
      And Alice has described the bug as "The board froze while offline"
      When Alice sends the bug report
      Then Alice is told the bug report will be sent when Alice is back online
      And the team has no bug report from Alice

    Scenario: A kept bug report reaches the team once back online
      Given Alice has sent a bug report saying "The board froze while offline" while offline
      When Alice's device is back online
      Then the team has a bug report from Alice saying "The board froze while offline"

    Scenario: A kept bug report survives reopening the app
      Given Alice has sent a bug report saying "The board froze while offline" while offline
      And Alice has reopened the app
      When Alice's device is back online
      Then the team has a bug report from Alice saying "The board froze while offline"

  Rule: A bug report the team cannot receive yet is kept and sent later

    @regression:feedback-raw-transport-error
    Scenario: Trouble receiving bug reports is explained plainly
      Given the team cannot receive bug reports
      And Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then Alice is told the bug report is kept and will be sent later
      And the team has no bug report from Alice

    Scenario: A kept bug report reaches the team once it can be received
      Given Alice has sent a bug report saying "The board froze after a move" while the team could not receive bug reports
      When the team can receive bug reports again
      Then the team has a bug report from Alice saying "The board froze after a move"

  Rule: A person sends at most 10 bug reports a day

    Scenario: The tenth bug report of the day reaches the team
      Given Alice has sent 9 bug reports today
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team has a bug report from Alice saying "The hint never appeared"

    Scenario: An eleventh bug report of the day is refused
      Given Alice has sent 10 bug reports today
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then Alice is told the daily bug report limit is reached until tomorrow
      And Alice's bug report says "The hint never appeared"

    Scenario: The daily bug report limit starts again the next day
      Given Alice sent 10 bug reports yesterday
      And Alice has described the bug as "The hint never appeared"
      When Alice sends the bug report
      Then the team has a bug report from Alice saying "The hint never appeared"
