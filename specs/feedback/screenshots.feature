@domain:feedback
Feature: Screenshots on a bug report
  When a person reports a bug, the person wants the team to see what the app
  was showing, so the bug is understood without a long description.

  Rule: A bug report starts with a screenshot of what the app was showing
    No counter-example: a bug report opens whether or not a screenshot could be taken.

    Scenario: Opening a bug report takes a screenshot
      Given Alice's app is working
      When Alice chooses to report a bug
      Then Alice's bug report has 1 screenshot
      And the screenshot shows the app as it was before the bug report opened

    Scenario: A device that cannot take a screenshot still opens a bug report
      Given Alice's device cannot take a screenshot
      When Alice chooses to report a bug
      Then Alice has one bug report open
      And Alice's bug report has 0 screenshots

  Rule: The person decides which screenshots the team gets
    No counter-example: the team only ever gets the screenshots still on the bug report.

    Scenario: A screenshot kept on the bug report reaches the team
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team's bug report from Alice has 1 screenshot

    Scenario: A removed screenshot never reaches the team
      Given Alice has described the bug as "The board froze after a move"
      And Alice has removed the screenshot
      When Alice sends the bug report
      Then the team's bug report from Alice has 0 screenshots

  Rule: A bug report carries at most 4 screenshots

    Scenario: A fourth screenshot is added
      Given Alice has a bug report with 3 screenshots
      When Alice adds a picture
      Then Alice's bug report has 4 screenshots

    Scenario: A fifth screenshot is refused
      Given Alice has a bug report with 4 screenshots
      When Alice adds a picture
      Then Alice is told a bug report carries at most 4 screenshots
      And Alice's bug report has 4 screenshots

  Rule: Only a picture can be added to a bug report

    Scenario: A picture is added
      Given Alice has opened a bug report
      When Alice adds a picture
      Then Alice's bug report has 2 screenshots

    Scenario: Something that is not a picture is refused
      Given Alice has opened a bug report
      When Alice adds something that is not a picture
      Then Alice is told only pictures can be added
      And Alice's bug report has 1 screenshot

  Rule: A picture added to a bug report is at most 5 MB

    Scenario: A picture of 5 MB is added
      Given Alice has opened a bug report
      When Alice adds a picture of 5 MB
      Then Alice's bug report has 2 screenshots

    Scenario: A picture of 6 MB is refused
      Given Alice has opened a bug report
      When Alice adds a picture of 6 MB
      Then Alice is told a picture can be up to 5 MB
      And Alice's bug report has 1 screenshot
