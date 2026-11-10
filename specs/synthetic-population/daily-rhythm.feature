@domain:synthetic-population
Feature: Synthetic Users keep a daily rhythm
  When people open the app at different times of day, they want
  Synthetic Users to come and go the way people do, so the app feels like it
  has a real community of players at every hour.

  Rule: A Synthetic User comes online now during its daily schedule whenever fewer Synthetic Users than the desired synthetic population are online now

    Background:
      Given the desired synthetic population is 3

    Scenario: A Synthetic User comes online now as its daily schedule begins
      Given 2 Synthetic Users are online now
      And the Synthetic User "Cedar" is not online now
      When "Cedar"'s daily schedule begins
      Then "Cedar" is online now within 15 minutes

    Scenario: A Synthetic User stays away when the desired synthetic population is already online now
      Given 3 Synthetic Users are online now
      And the Synthetic User "Cedar" is not online now
      When "Cedar"'s daily schedule begins
      Then "Cedar" is still not online now 15 minutes later

    Scenario: A Synthetic User kept away comes online now once there is room
      Given 3 Synthetic Users are online now, "Maple" among them
      And "Cedar"'s daily schedule has begun while it was kept away
      When "Maple"'s daily schedule is over
      Then "Cedar" is online now within 15 minutes

  Rule: A place that frees up goes at once to the Synthetic User kept away longest

    Background:
      Given the desired synthetic population is 3
      And 3 Synthetic Users are online now, "Maple" among them
      And "Birch" has been kept away longer than "Cedar"

    Scenario: The Synthetic User kept away longest comes online now when a place frees up
      When "Maple"'s daily schedule is over
      Then "Birch" is online now within 15 minutes

    Scenario: A Synthetic User kept away for less time waits for the next free place
      When "Maple"'s daily schedule is over
      Then "Cedar" is still not online now 15 minutes later

  Rule: A Synthetic User is no longer online now once its daily schedule is over, after finishing any ongoing game

    Scenario: A Synthetic User closes the app once its daily schedule is over
      Given the Synthetic User "Cedar" is available
      When "Cedar"'s daily schedule is over
      Then "Cedar" is not online now within 15 minutes

    Scenario: A Synthetic User finishes its ongoing game once its daily schedule is over
      Given the Synthetic User "Cedar" has an ongoing "chess" game
      When "Cedar"'s daily schedule is over
      Then "Cedar" is still online now while it finishes its ongoing game
      And "Cedar" starts no new activity

  Rule: Apart from Synthetic Users finishing an ongoing game, no more Synthetic Users are online now than the desired synthetic population

    Background:
      Given Alice is authorized to configure the Synthetic Population

    Scenario: Lowering the desired synthetic population leaves fewer Synthetic Users online now
      Given 4 Synthetic Users are online now, none of them playing
      When Alice changes the desired synthetic population to 2
      Then 2 Synthetic Users are online now within 15 minutes

    Scenario: A Synthetic User above the desired synthetic population finishes its ongoing game first
      Given the Synthetic User "Cedar" has an ongoing "chess" game
      When Alice changes the desired synthetic population to 0
      Then "Cedar" is still online now while it finishes its ongoing game
      And "Cedar" starts no new activity
