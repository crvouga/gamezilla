@domain:developer-tools
Feature: Explore the app through its specs and automated evidence
  When the team investigates a version of the app, the team wants to explore
  every spec and its automated evidence, so missing evidence remains visible.

  Rule: Every spec remains available whether or not it has a test report
    No counter-example: having no test report changes the evidence, never which specs exist.

    Scenario: A spec with evidence offers its test report
      Given a version of the app has specs with completed test reports
      When the team explores that version's specs
      Then the team can read each spec and open its test reports

    @regression:reports-local-empty
    Scenario: A spec without evidence explains what is missing
      Given a version of the app has a spec without a completed test report
      When the team explores that version's specs
      Then the team can read that spec
      And the team is told it has no completed test report

  Rule: Independently completed report parts combine for the same version of the app

    Scenario: A completed UI quality check appears alongside earlier evidence
      Given a version of the app has completed test reports and a newly completed UI quality check
      When the team explores that version's report parts
      Then the team sees both the test reports and the UI quality check

    Scenario: Another version's report part supplies no evidence for this version
      Given a performance check belongs only to a later version of the app
      When the team explores the earlier version's report parts
      Then the team is told the earlier version has no completed performance check

  Rule: A report part without completed evidence explains its absence

    Scenario: A completed performance check shows its measured outcome
      Given a version of the app has a completed performance check
      When the team explores that version's report parts
      Then the team sees the performance check's measured outcome

    Scenario: An unperformed UI quality check never supplies passing evidence
      Given a version of the app has no completed UI quality check
      When the team explores that version's report parts
      Then the team is told the UI quality check has not been completed

  Rule: Unavailable test reports explain the problem and allow another attempt

    @regression:reports-unavailable-hidden
    Scenario: Unavailable test reports show an explanation
      Given the team's test reports are unavailable
      When the team investigates which test reports are available
      Then the team is told why the test reports are unavailable
      And the team is offered another attempt

    Scenario: Another attempt restores the test reports when they become available
      Given the team's unavailable test reports have become available
      When the team asks to open the test reports again
      Then the team sees the available test reports
