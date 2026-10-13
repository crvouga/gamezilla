@domain:spaces
Feature: A space created with no connection meets the account's other device
  When a person creates a space with no connection, they want their other
  device to meet that space once the connection is back, so the account
  hosts the spaces the hosting limit allows.

  Rule: Another device does not see a space until the device that created it has a connection

    Scenario: The other device is not offered the space while the host is still offline
      Given Alice is hosting a space created offline
      And Alice is also signed in on another device
      When Alice's other device returns to their space
      Then Alice is not offered to return to their space on her other device

    Scenario: The lobby lists the space once the connection comes back
      Given Alice is hosting a space created offline
      And Alice is also signed in on another device
      When the connection comes back
      Then Alice's lobby lists Alice's space
      And Alice hosts 1 space

    Scenario: The other device can return once the connection is back
      Given Alice is hosting a space created offline
      And the connection has come back
      When Alice returns to their space on another device
      Then Alice's other device is in the same space
      And Alice hosts 1 space

  Rule: Two spaces created offline on a free account become one when both devices have a connection

    Scenario: The later offline space ends and that device is invited to Plus
      Given Alice is hosting a space created offline on her phone and a later space created offline on her other device
      When the connection comes back
      Then Alice hosts 1 space
      And Alice is told their hosting limit is reached and invited to get Plus
      And Alice's other device is in the space her phone created

    Scenario: A Plus member keeps both spaces created offline
      Given Alice is a Plus member hosting a space created offline on her phone and a later space created offline on her other device
      When the connection comes back
      Then Alice hosts 2 spaces
