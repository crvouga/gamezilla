@domain:observatory
Feature: See whoever is online now
  When people and Synthetic Users are using the app, an authorized person
  wants to see who is online now and what each one is doing, so the team
  understands how the app is used.

  Rule: An authorized person sees whoever is online now, each with its activity and whether it is a person or a Synthetic User

    Scenario: An authorized person sees a person online now and what they are doing
      Given Alice is authorized to view the User Observatory
      And Bob is looking for a multiplayer opponent for "chess"
      When Alice opens the User Observatory
      Then Alice sees Bob online now as a person looking for a multiplayer opponent for "chess"

    Scenario: An authorized person sees a Synthetic User online now and what it is doing
      Given Alice is authorized to view the User Observatory
      And the Synthetic User "Cedar" has an ongoing "Connect Four" game
      When Alice opens the User Observatory
      Then Alice sees "Cedar" online now as a Synthetic User playing "Connect Four"

    Scenario: A person without permission sees nobody online now
      Given Bob is not authorized to view the User Observatory
      And Carol is using the app now
      When Bob opens the User Observatory
      Then Bob is told that permission is required
      And Bob does not see Carol online now

  Rule: An authorized person can show only people or only Synthetic Users
    No counter-example: showing only some of those online now hides the others, as each scenario shows.

    Background:
      Given Alice has opened the User Observatory
      And Bob and the Synthetic User "Cedar" are using the app now

    Scenario: Showing only people hides Synthetic Users
      When Alice shows only people online now
      Then Alice sees Bob online now
      And Alice does not see "Cedar" online now

    Scenario: Showing only Synthetic Users hides people
      When Alice shows only Synthetic Users online now
      Then Alice sees "Cedar" online now
      And Alice does not see Bob online now

  Rule: Only those online now are listed
    No counter-example: while someone uses the app with a connection, nothing removes them from the list, as the last scenario shows.

    Background:
      Given Alice has opened the User Observatory

    Scenario: A person who opens the app is listed
      When Bob opens the app
      Then Alice sees Bob online now within 30 seconds

    Scenario: A person who closes the app is no longer listed
      Given Bob is using the app now
      When Bob closes the app
      Then Alice does not see Bob online now within 30 seconds

    Scenario: A Synthetic User whose daily schedule is over is no longer listed
      Given the Synthetic User "Cedar" is available
      When "Cedar"'s daily schedule is over
      Then Alice does not see "Cedar" online now within 15 minutes

    Scenario: A person who moves around the app stays listed
      Given Bob is using the app now
      When Bob opens Settings
      Then Alice sees Bob online now
