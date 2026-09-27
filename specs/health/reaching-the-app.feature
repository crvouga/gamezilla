@domain:health
Feature: Reaching the app
  People find the app at its addresses and reach it securely, and they will
  for weeks to come, so an address never lapses unnoticed.

  Scenario: People can find the app at every one of its addresses
    Then people can find the app at every one of its addresses

  Scenario: Every address stays secure for at least two more weeks
    Then people reach every address of the app securely for 14 more days

  Scenario: People can open the app at its address
    Then people can open the app at its address

  Scenario: The team can open the Simulator at its address
    Then the team can open the Simulator at its address

  Scenario: Leaving out "www" still leads people to the app
    Then the address without "www" leads people to the app
