@domain:health
Feature: Object store
  The environment's bucket is its own, and the app's key can use it.

  Scenario: The bucket is this environment's own
    Then the object store bucket is this environment's bucket

  Scenario: The app's key can write, read and delete a file
    Then the app's key can write, read back and delete a file under its root prefix
