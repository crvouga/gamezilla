@domain:profile @goal:works-offline:5
Feature: The devices on an account
  When a person wonders where they are signed in, they want to see every
  device on their account, so a device they do not recognize stands out.

  Scenario: Alice sees each device signed into their account
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    When Alice opens their devices
    Then Alice sees 2 devices on their account
    And Alice's devices mark the one Alice is using

  Scenario: A device that signs out is no longer among the devices on the account
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    And Alice has signed out on their other device
    When Alice opens their devices
    Then Alice sees 1 device on their account within 30 seconds

  Scenario: A guest looking for their devices is asked to sign in
    Given Alice is a guest
    When Alice opens their devices
    Then Alice is asked to sign in within 5 seconds
