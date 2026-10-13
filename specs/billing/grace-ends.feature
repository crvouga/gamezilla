@domain:billing
Feature: When paid access runs out
  When a membership ends or a Plus member goes offline, the person wants paid
  access to last exactly what they paid for plus the 7 days of grace, so
  nobody keeps it longer and nobody who paid loses it early, online or
  offline.

  Rule: A canceled membership keeps paid access for 7 days, and no longer

    Scenario: Six days after a canceled membership ends, access is still paid
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal
      And Alice's billing period has ended
      When 6 days pass
      Then Alice has paid access

    Scenario: Eight days after a canceled membership ends, access is free
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal
      And Alice's billing period has ended
      When 8 days pass
      Then Alice has free access

  Rule: A Plus member offline keeps paid access for 7 days

    Scenario: A Plus member offline for six days keeps paid access
      Given Alice has subscribed to Plus
      And Alice is offline
      When 6 days pass
      Then Alice has paid access

    Scenario: A Plus member offline for eight days falls back to free access
      Given Alice has subscribed to Plus
      And Alice is offline
      When 8 days pass
      Then Alice has free access

    Scenario: A Plus member back online after a long time away has paid access again
      Given Alice has subscribed to Plus
      And Alice has been offline for 8 days
      When the connection comes back
      Then Alice has paid access within 30 seconds

  Rule: Signing in again during grace keeps the paid access, and after grace it is free

    Scenario: Signing in again during grace keeps paid access
      Given Alice has subscribed to Plus
      And Alice's free trial has ended
      And Alice has canceled the membership in the billing portal
      When Alice's billing period has run out
      And Alice signs in with Google
      And Alice views the billing plans
      Then Alice has paid access

    Scenario: Signing in again after grace has free access
      Given Alice has subscribed to Plus
      And Alice's free trial has ended
      And Alice has canceled the membership in the billing portal
      When Alice's billing period has run out
      And Alice signs in with Google
      And 8 days pass
      Then Alice has free access
