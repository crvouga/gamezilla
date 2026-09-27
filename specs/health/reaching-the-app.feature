@domain:health
Feature: Reaching the app
  People find the app at its addresses and reach it securely, and they will
  for weeks to come, so an address never lapses unnoticed.

  Scenario: People can find the app at every one of its addresses
    Then people can find the app at every one of its addresses

  Scenario: Every address stays secure for at least two more weeks
    Then people reach every address of the app securely for 14 more days

  Scenario Outline: People can open <place> at its address
    Then people can open "<place>" at its address

    Examples:
      | place         |
      | the app       |
      | the Simulator |

  Scenario: Leaving out "www" still leads people to the app
    Then the address without "www" leads people to the app
