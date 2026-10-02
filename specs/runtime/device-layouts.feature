@domain:runtime
Feature: Use the complete app on every supported device
  When people use different devices, they want every capability to remain
  available, so the app fits their device without sacrificing progress.

  Rule: Changing the available space keeps the person's place and work
    No counter-example: changing a device's orientation or a computer window is not a command to abandon progress.

    Scenario: Turning a phone preserves the person's place
      Given Alice is using the app on a phone
      And Alice has a place in the app and saved preferences
      When Alice turns the phone from portrait to landscape
      Then Alice has the same place in the app and saved preferences
      And Alice can reach every control offered there

    Scenario: Turning a tablet preserves the person's place
      Given Alice is using the app on a tablet
      And Alice has a place in the app and saved preferences
      When Alice turns the tablet from landscape to portrait
      Then Alice has the same place in the app and saved preferences
      And Alice can reach every control offered there

    Scenario: Narrowing a computer's app keeps its controls available
      Given Alice is using the app on a computer
      And Alice has a place in the app and saved preferences
      When Alice narrows the space available to the app
      Then Alice has the same place in the app and saved preferences
      And Alice can reach every control offered there
