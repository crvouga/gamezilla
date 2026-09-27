@domain:health
Feature: Postgres
  The environment's database answers, and its schema is what the app
  declares (migrations ran).

  Scenario: The database accepts a read-only query
    Then the database answers a read-only query

  Scenario: The database has every declared table and column
    Then the database has every table and column the app declares
