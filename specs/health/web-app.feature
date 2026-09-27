@domain:health
Feature: Web app hosting
  The environment's client Worker serves the app shell on www, and the apex
  domain leads there.

  Scenario Outline: The web app serves its shell at <path>
    Then the web app serves its shell at "<path>"

    Examples:
      | path       |
      | /          |
      | /simulator |

  Scenario: The apex domain serves or redirects to the web app
    Then the apex domain answers without an error
