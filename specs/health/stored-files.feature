@domain:health
Feature: Stored files
  Files the app keeps, such as what people upload, are kept, read back and
  removed, and stay apart from every other environment's files.

  Scenario: This environment's files are its own
    Then this environment keeps its files apart from every other environment's

  Scenario: The app can keep, read back and remove a file
    Then the app can keep a file, read it back and remove it
