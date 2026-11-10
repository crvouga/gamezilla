@domain:synthetic-population
Feature: Synthetic Users have personas of their own
  When people meet Synthetic Users, they want each one to feel like a
  different player, so the app feels like it has a real community of players
  while every Synthetic User is still identified as one.

  Rule: Every Synthetic User has a complete persona of its own
    No counter-example: the Synthetic Population gives every Synthetic User its persona; nothing a person does leaves one without it.

    Scenario: A new Synthetic User arrives with a complete persona
      Given Alice is authorized to configure the Synthetic Population
      And the desired synthetic population is 0
      When Alice changes the desired synthetic population to 1
      Then Alice sees a new Synthetic User with a complete persona within 1 minute

  Rule: Two Synthetic Users never share a username
    No counter-example: the Synthetic Population chooses every Synthetic User's username; a person never gives one a username.

    Scenario: Twelve Synthetic Users each have a username of their own
      Given the Synthetic Population has 12 Synthetic Users
      And Alice is authorized to view the Bot Observatory
      When Alice opens the Bot Observatory
      Then Alice sees 12 Synthetic Users, each with a different username

  Rule: A Synthetic User's username reads like one a person chose, with no pattern shared across the Synthetic Population
    No counter-example: the Synthetic Population chooses every Synthetic User's username; a person never gives one a username.

    Scenario: Twelve Synthetic Users' usernames follow no shared pattern
      Given the Synthetic Population has 12 Synthetic Users
      And Alice is authorized to view the Bot Observatory
      When Alice opens the Bot Observatory
      Then no three Synthetic User usernames begin with the same three letters
      And no two Synthetic User usernames differ only by a number

  Rule: A Synthetic Population of 12 or more is varied in skill levels and favorite games
    No counter-example: the Synthetic Population chooses every persona; nothing a person does makes it less varied.

    Scenario: Twelve Synthetic Users play at several skill levels and favor several games
      Given the Synthetic Population has 12 Synthetic Users
      And Alice is authorized to view the Bot Observatory
      When Alice opens the Bot Observatory
      Then Alice sees Synthetic Users of at least 3 different skill levels
      And Alice sees at least 3 different favorite games among the Synthetic Users

  Rule: A Synthetic User keeps its persona for good
    No counter-example: nobody can change a Synthetic User's persona; the Bot Observatory offers no way to.

    Scenario: A Synthetic User keeps its persona after closing and reopening the app
      Given the Synthetic User "Cedar" is available
      When the Synthetic User "Cedar" closes and reopens the app
      Then the Synthetic User "Cedar" keeps its persona

    Scenario: A Synthetic User comes back the next day with the same persona
      Given the Synthetic User "Cedar" closed the app once its daily schedule was over yesterday
      When "Cedar"'s daily schedule begins
      Then the Synthetic User "Cedar" keeps its persona
