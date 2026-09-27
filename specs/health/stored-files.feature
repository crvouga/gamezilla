@domain:health
Feature: Stored files
  When people upload something, they want the app to keep it as a stored
  file, apart from every other environment's, so it is there when they come
  back to it.

  Scenario: This environment's files are its own
    Then this environment keeps its files apart from every other environment's

  Scenario: The app can keep, read back and remove a file
    Then the app can keep a file, read it back and remove it
