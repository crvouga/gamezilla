@domain:feedback
Feature: Report a bug with the keyboard alone and by listening
  When someone uses the keyboard alone or listens to the app, they want to
  report a bug like anyone else, so a bug that gets in their way still
  reaches the team.

  Rule: The keyboard alone can open, describe and send a bug report
    No counter-example: the keyboard is another way to make the same choices; every refusal stays the same.

    Background:
      Given Alice is using the keyboard alone

    Scenario: A person using the keyboard alone opens a bug report
      When Alice chooses to report a bug
      Then Alice has one bug report open
      And Alice's keyboard is in the bug report

    Scenario: A person using the keyboard alone sends a bug report
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then the team has a bug report from Alice saying "The board froze after a move"

    Scenario: The keyboard reaches every control of a bug report once, in the order they are shown
      Given Alice has opened a bug report
      When Alice moves the keyboard through the bug report
      Then Alice's keyboard reaches every control of the bug report once, in the order they are shown

  Rule: Writing a description keeps the keyboard on the description
    No counter-example: writing a description is never refused; the rule is only where the keyboard stays.

    @regression:feedback-typing-steals-focus
    Scenario: Writing a description keeps the person in the description they are writing
      Given Alice is using the keyboard alone
      And Alice has opened a bug report
      When Alice describes the bug as "The board froze after a move"
      Then Alice's keyboard stays on the description
      And Alice's bug report says "The board froze after a move"

  Rule: Closing a bug report gives the keyboard back where it was
    No counter-example: a person can always close a bug report; the rule is only where the keyboard lands.

    Scenario: Closing a bug report puts the keyboard back where it was
      Given Alice is using the keyboard alone
      And Alice has opened a bug report
      When Alice closes the bug report
      Then Alice's keyboard is back where it was before Alice opened the bug report

  Rule: Listening describes a bug report's controls, its screenshots and what became of it
    No counter-example: what a person hears is part of the bug report; nothing a person does takes it away.

    Background:
      Given Alice is listening to the app

    Scenario: Someone listening hears what every control of a bug report does
      When Alice chooses to report a bug
      Then Alice hears what every control of the bug report does

    Scenario: Someone listening hears how many screenshots a bug report has
      Given Alice has opened a bug report
      When Alice adds a picture
      Then Alice hears that the bug report has 2 screenshots

    Scenario: Someone listening hears that the team has the bug report
      Given Alice has described the bug as "The board froze after a move"
      When Alice sends the bug report
      Then Alice hears that the team has the bug report

    Scenario: Someone listening hears that a bug report is kept to be sent later
      Given Alice's device is offline
      And Alice has described the bug as "The board froze while offline"
      When Alice sends the bug report
      Then Alice hears that the bug report will be sent when Alice is back online

    Scenario: Someone listening hears why a bug report was not sent
      Given Alice has opened a bug report
      When Alice sends the bug report
      Then Alice hears that the bug report needs a description before it is sent
