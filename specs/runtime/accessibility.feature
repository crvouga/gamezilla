@domain:runtime
Feature: Using the app without seeing it or without a mouse
  When a person cannot see the app, or cannot use a mouse or touch, they want
  to hear what everything in it does and do everything with the keyboard
  alone, so no part of the app is closed to them.

  Rule: Every control says what it does to someone listening to the app
    No counter-example: what a control says is part of the app; nothing a person does takes it away.

    Background:
      Given Alice is listening to the app

    Scenario: Someone listening hears what every control on the tabs does
      When Alice opens the app
      Then Alice hears what every control on the tabs does

    Scenario: Someone listening hears what every control in Settings does
      When Alice opens Settings
      Then Alice hears what every control in Settings does

  Rule: A picture that means something is described to someone listening to the app
    No counter-example: a picture's description is part of the app; nothing a person does takes it away.

    Scenario: Someone listening hears their avatar described
      Given Alice is listening to the app
      When Alice opens the Profile tab
      Then Alice hears the picture on their profile described as their avatar

  Rule: Everything a person can do in the app, they can do with the keyboard alone
    No counter-example: the keyboard alone is a way of using the app, never something a person is stopped for.

    Background:
      Given Alice is using the keyboard alone

    Scenario: A person using the keyboard alone goes to another tab
      When Alice opens the Notifications tab
      Then Alice is on Notifications

    Scenario: The keyboard reaches every control on the tabs once, in the order they are shown
      When Alice moves the keyboard through the tabs
      Then Alice's keyboard reaches every control on the tabs once, in the order they are shown

  Rule: Settings takes the keyboard when it opens and gives it back where it was when the person comes back
    No counter-example: a person can always open Settings from the tabs and come back; the rule is only where the keyboard lands.

    Background:
      Given Alice is using the keyboard alone

    Scenario: Opening Settings brings the keyboard into Settings
      When Alice opens Settings
      Then Alice is on Settings
      And Alice's keyboard is in Settings

    Scenario: Coming back from Settings puts the keyboard back where it was
      Given Alice has opened Settings from Spaces
      When Alice comes back from Settings
      Then Alice is on Spaces
      And Alice's keyboard is back where it was before Alice opened Settings
