@domain:synthetic-population
Feature: Observe whoever is online now
  When people and Synthetic Users are using the app, an authorized person
  wants to see what each one online now is doing and watch any of them live,
  so the team understands how the app is used without ever seeing a person's
  private details.

  Rule: An authorized person sees whoever is online now, each with its activity and whether it is a person or a Synthetic User

    Scenario: An authorized person sees a person online now and what they are doing
      Given Alice is authorized to view the Bot Observatory
      And Bob is looking for a multiplayer opponent for "chess"
      When Alice opens the Bot Observatory
      Then Alice sees Bob online now as a person looking for a multiplayer opponent for "chess"

    Scenario: An authorized person sees a Synthetic User online now and what it is doing
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" has an ongoing "Connect Four" game
      When Alice opens the Bot Observatory
      Then Alice sees "Cedar" online now as a Synthetic User playing "Connect Four"

    Scenario: A person without permission sees nobody online now
      Given Bob is not authorized to view the Bot Observatory
      And Carol is online now
      When Bob opens the Bot Observatory
      Then Bob is told that permission is required
      And Bob does not see Carol online now

  Rule: An authorized person can show only people or only Synthetic Users
    No counter-example: showing only some of those online now hides the others, as each scenario shows.

    Background:
      Given Alice has opened the Bot Observatory
      And Bob and the Synthetic User "Cedar" are online now

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
      Given Alice has opened the Bot Observatory

    Scenario: A person who opens the app is listed
      When Bob opens the app
      Then Alice sees Bob online now within 30 seconds

    Scenario: A person who closes the app is no longer listed
      Given Bob is online now
      When Bob closes the app
      Then Alice does not see Bob online now within 30 seconds

    Scenario: A Synthetic User whose daily schedule is over is no longer listed
      Given the Synthetic User "Cedar" is available
      When "Cedar"'s daily schedule is over
      Then Alice does not see "Cedar" online now within 15 minutes

    Scenario: A person who moves around the app stays listed
      Given Bob is online now
      When Bob opens Settings
      Then Alice sees Bob online now

  Rule: An authorized person can watch live anyone online now, a person or a Synthetic User

    Scenario: An authorized person watches a person live
      Given Alice is authorized to watch someone live
      And Bob is online now
      When Alice watches Bob live
      Then Alice sees Bob's place in the app within 5 seconds

    Scenario: Watching a person live follows them around the app
      Given Alice is watching Bob live
      When Bob opens Settings
      Then Alice sees Bob's place in the app is Settings within 5 seconds

    Scenario: Watching a Synthetic User live shows its game as it plays
      Given Alice is authorized to watch someone live
      And the Synthetic User "Cedar" has an ongoing "chess" game
      When Alice watches "Cedar" live
      Then Alice sees "Cedar"'s ongoing "chess" game as "Cedar" sees it within 5 seconds

    Scenario: A person without permission cannot watch someone live
      Given Bob is not authorized to watch someone live
      And Carol is online now
      When Bob watches Carol live
      Then Bob is told that permission is required
      And Bob does not see Carol's place in the app

  Rule: Watching a person live never shows their private details
    No counter-example: a person's private details are never shown to anyone watching live.

    Background:
      Given Alice is watching Bob live

    Scenario: A person's email address stays hidden while they are watched live
      When Bob opens Settings
      Then Alice cannot see Bob's email address

    Scenario: What a person searches for stays hidden while they are watched live
      When Bob searches for "carol"
      Then Alice sees Bob's place in the app is people search within 5 seconds
      And Alice cannot see what Bob searched for

  Rule: Watching live stops when the one watched is no longer online now
    No counter-example: while the one watched is online now, watching continues, as the rule before shows.

    Scenario: Watching a person live stops when they close the app
      Given Alice is watching Bob live
      When Bob closes the app
      Then Alice is told Bob is no longer online now within 30 seconds

    Scenario: Watching a Synthetic User live stops once its daily schedule is over
      Given Alice is watching the Synthetic User "Cedar" live
      When "Cedar"'s daily schedule is over
      Then Alice is told "Cedar" is no longer online now within 15 minutes
