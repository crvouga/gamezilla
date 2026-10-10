@domain:synthetic-population
Feature: Recognize Synthetic Users in multiplayer chess
  When people play multiplayer chess, they want to recognize Synthetic Users,
  so they can distinguish automated opponents from people.

  Background:
    Given the Synthetic User "Cedar" has an ongoing game

  Rule: A Synthetic User is identified as automated wherever its username appears
    No counter-example: every Synthetic User must be recognizable to people.

    @regression:synthetic-population-classification-before-profile-hydration
    Scenario: A person recognizes the Synthetic User in their game
      When Bob opens multiplayer chess
      Then Bob sees "Cedar" identified as a Synthetic User

  Rule: A person's username never identifies them as a Synthetic User
    No counter-example: a person is never classified as an automated opponent.

    Scenario: A person recognizes their own username in the game
      When Bob opens multiplayer chess
      Then Bob sees Bob without Synthetic User identification
