@domain:observatory
Feature: Watch someone live
  When someone is using the app, an authorized person wants to watch them
  live, so the team sees the app as they see it without ever seeing a
  person's private details.

  Rule: An authorized person can watch live anyone online now, a person or a Synthetic User

    Scenario: An authorized person watches a person live
      Given Alice is authorized to watch someone live
      And Bob is using the app now
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
      And Carol is using the app now
      When Bob watches Carol live
      Then Bob is told that permission is required
      And Bob does not see Carol's place in the app

  Rule: Watching a person live never shows their private details
    No counter-example: a person's private details are never shown to anyone watching live.

    Background:
      Given Alice is watching Bob live

    Scenario: The email address on a person's sign-in method stays hidden while they are watched live
      Given Bob is signed in with Google
      When Bob looks at his sign-in methods
      Then Alice sees Bob's place in the app is his sign-in methods within 5 seconds
      And Alice cannot see the email address of Bob's Google sign-in method

    Scenario: What a person searches for stays hidden while they are watched live
      When Bob searches for "carol"
      Then Alice sees Bob's place in the app is people search within 5 seconds
      And Alice cannot see what Bob searched for

  Rule: Watching live stops when the one watched is no longer online now
    No counter-example: while the one watched is online now, watching goes on, as the rule before shows.

    Scenario: Watching a person live stops when they close the app
      Given Alice is watching Bob live
      When Bob closes the app
      Then Alice is told Bob is no longer online now within 30 seconds

    Scenario: Watching a Synthetic User live stops once its daily schedule is over
      Given Alice is watching the Synthetic User "Cedar" live
      When "Cedar"'s daily schedule is over
      Then Alice is told "Cedar" is no longer online now within 15 minutes
