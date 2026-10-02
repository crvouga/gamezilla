@domain:developer-tools
Feature: Keep questions about a test world
  When the team investigates a test world's data, the team wants to keep
  questions and see their answers, so an investigation can be continued later.

  Rule: Each selected device keeps its own data notebook
    No counter-example: choosing a different device opens that device's data notebook, without replacing another's questions.

    Scenario: Returning to a device brings back its saved questions
      Given Alice's phone has a saved data notebook question about her friends
      And the team has been investigating Bob's phone
      When the team opens the data notebook for Alice's phone
      Then the team sees Alice's saved data notebook question about her friends

    Scenario: Another device's questions do not replace the first device's questions
      Given Alice's phone has a saved data notebook question about her friends
      And Bob's phone has a saved data notebook question about his spaces
      When the team opens the data notebook for Bob's phone
      Then the team sees Bob's saved data notebook question about his spaces
      And Alice's data notebook still keeps the question about her friends

  Rule: A duplicated question sits beside its original without answering automatically

    Scenario: Duplication keeps the original question and makes a separate copy
      Given the team's data notebook has a question about Alice's friends
      When the team duplicates the data notebook question about Alice's friends
      Then the team sees the copied question immediately after its original

    Scenario: A copy cannot start answering automatically
      Given the team's data notebook question about Alice's friends answers automatically
      When the team duplicates the data notebook question about Alice's friends
      Then the copied question still waits for the team to ask for its answer

  Rule: A data notebook always keeps at least one question

    Scenario: Removing one of two questions keeps the other
      Given the team's data notebook has questions about Alice's friends and Alice's spaces
      When the team removes the data notebook question about Alice's friends
      Then the team sees only the data notebook question about Alice's spaces

    Scenario: The last question cannot be removed
      Given the team's data notebook has only a question about Alice's friends
      When the team removes the data notebook question about Alice's friends
      Then the data notebook still has that question because it is the last one

  Rule: Asking a question shows its answer or why it failed

    Scenario: A successful question shows an answer
      Given the team's data notebook has a question about Alice's friends
      When the team runs the data notebook question about Alice's friends
      Then the team sees the question's answer

    Scenario: A failed question shows the failure
      Given the team has a data notebook question that cannot be answered
      When the team runs that data notebook question
      Then the team is told why the data notebook question failed
