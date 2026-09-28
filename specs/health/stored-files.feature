@domain:health
Feature: Keeping what people upload
  When people upload something, such as a picture, they want the app to keep
  it apart from every other environment's uploads, so it is there when they
  come back to it.

  Scenario: This environment's uploads are its own
    Then this environment keeps its uploads apart from every other environment's

  Scenario: The app can keep an upload, show it again and remove it
    Then the app can keep an upload, show it again and remove it
