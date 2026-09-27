@domain:profile @goal:works-offline:5
Feature: The devices on an account
  A person can see every device signed into their account, so they notice one
  they do not recognize and know where they are signed in.

  Scenario: Alice sees each device signed into their account
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    When Alice opens their devices
    Then Alice sees 2 devices on their account
    And Alice's devices mark the one Alice is using

  Scenario: A device that signs out leaves the list
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    And Alice has signed out on their other device
    When Alice opens their devices
    Then Alice sees 1 device on their account within 30 seconds

  Scenario: A guest looking for their devices is asked to sign in
    Given Alice is a guest
    When Alice opens their devices
    Then Alice is asked to sign in within 5 seconds
