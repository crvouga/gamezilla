@domain:feedback
Feature: Open a bug report from anywhere
  When a person notices a bug, the person wants to start a bug report from
  wherever they are, so the bug is reported while it is still in front of them.

  Rule: Choosing to report a bug opens one bug report
    No counter-example: choosing to report a bug always opens one, and only one.

    Scenario: Choosing to report a bug opens a bug report
      Given Alice's app is working
      When Alice chooses to report a bug
      Then Alice has one bug report open

    Scenario: Choosing to report a bug again keeps the same bug report
      Given Alice has described the bug as "The board froze after a move"
      When Alice chooses to report a bug
      Then Alice has one bug report open
      And Alice's bug report says "The board froze after a move"

    Scenario: A closed bug report takes no place in the app
      Given Alice has opened a bug report
      When Alice closes the bug report
      Then Alice has no bug report open

  Rule: Shaking a phone opens a bug report

    Scenario: A shake opens a bug report
      Given Alice's app is working
      When Alice shakes the phone
      Then Alice has one bug report open

    Scenario: A shake with shake to report turned off opens nothing
      Given Alice has turned off shake to report
      When Alice shakes the phone
      Then Alice still has no bug report open

    Scenario: A shake while a bug report is open keeps the same bug report
      Given Alice has described the bug as "The board froze after a move"
      When Alice shakes the phone
      Then Alice has one bug report open
      And Alice's bug report says "The board froze after a move"

  Rule: A phone that asks before the app may notice shaking waits for the person

    Scenario: A shake the phone has not allowed opens nothing
      Given Alice's phone asks before the app may notice shaking
      When Alice shakes the phone
      Then Alice still has no bug report open

    Scenario: A shake the person has allowed opens a bug report
      Given Alice's phone asks before the app may notice shaking
      And Alice has allowed shake to report
      When Alice shakes the phone
      Then Alice has one bug report open

    Scenario: A person who refuses shaking is told how to report a bug
      Given Alice's phone asks before the app may notice shaking
      When Alice refuses to allow shake to report
      Then Alice is told to choose to report a bug instead of shaking

  Rule: A bug report opens even when the app is unusable
    No counter-example: trouble in the app never takes away reporting a bug.

    Scenario: An app that has crashed still opens a bug report
      Given Alice's app has crashed
      When Alice chooses to report a bug
      Then Alice has one bug report open

    Scenario: An app that stays loading still opens a bug report
      Given Alice's app stays loading
      When Alice shakes the phone
      Then Alice has one bug report open

    Scenario: An app that cannot sign in still opens a bug report
      Given Alice's app cannot sign in
      When Alice chooses to report a bug
      Then Alice has one bug report open
