@domain:spaces
Feature: How many spaces a person can host
  When a person already hosts as many spaces as their hosting limit allows and
  wants another, they want to be invited to Plus rather than stopped by an
  error, so hosting more is something worth paying for. Guests and free
  accounts host one space at a time; Plus members host as many as they like.

  Rule: Guests and free accounts host one space at a time

    Scenario: A free account hosting a space is invited to Plus to host another
      Given Alice is signed in
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is invited to get Plus to host more spaces
      And Alice hosts 1 space

    Scenario: A guest hosting a space is invited to Plus to host another
      Given Alice is a guest
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is invited to get Plus to host more spaces
      And Alice hosts 1 space

    Scenario: Ending a space frees the place for a new one
      Given Alice is signed in
      And Alice has hosted a space and ended it
      When Alice creates a space
      Then Alice is in the space
      And Alice is not invited to get Plus

  Rule: Plus members never reach a hosting limit
    No counter-example: a guest or a free account at their hosting limit is the first rule's refusal.

    Scenario: A Plus member hosts a second space at once
      Given Alice is a Plus member
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is in the space
      And Alice hosts 2 spaces
