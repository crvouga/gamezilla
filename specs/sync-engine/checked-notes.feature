@domain:sync-engine
Feature: Checked notes
  When a note must pass a rule only everyone else can check, such as a note
  that may not say "refused", its writer wants the app to say it is saving
  until the answer comes, and then that it is saved or that it was refused,
  so they only ever act on what was really kept.

  Background:
    Given Alice and Bob use the app

  Rule: A checked note shows at once, is saving until it is kept for everyone, and is then saved
    No counter-example: allowed writing always shows while saving and is then saved; refusal is covered separately.

    Scenario: A checked note shows at once and is saving
      When Alice writes the checked note "Groceries" saying "milk"
      Then Alice sees the note "Groceries" at once
      And Alice's app says the note "Groceries" is still saving

    Scenario: A checked note is saved once it is kept for everyone
      When Alice writes the checked note "Groceries" saying "milk"
      Then Alice's app says the note "Groceries" is saved
      And Bob sees the note "Groceries" saying "milk"

  Rule: A checked note that breaks the rule is refused and goes back to what it said before
    No counter-example: writing that breaks the checked note's rule is always refused.

    Scenario: Refused writing never replaces another person's shared note
      Given Alice and Bob have slow connections
      And Alice has written the checked note "Groceries" saying "milk"
      And the note "Groceries" has reached Bob
      When Alice writes the checked note "Groceries" saying "refused"
      Then Bob never sees the note "Groceries" saying "refused"
      And Bob sees the note "Groceries" saying "milk"

    Scenario: A checked note that breaks the rule is refused
      When Alice writes the checked note "Groceries" saying "refused"
      Then Alice's app says the note "Groceries" was refused
      And Alice does not see the note "Groceries"
      And Bob does not see the note "Groceries"

    Scenario: By the time a refusal is reported, the note already says what it said before
      Given Alice has written the checked note "Groceries" saying "milk"
      When Alice writes the checked note "Groceries" saying "refused"
      Then the moment Alice's app says the note "Groceries" was refused, it shows the note saying "milk"
      And Bob sees the note "Groceries" saying "milk"
