@domain:spaces @goal:guest-free-and-paid:1 @goal:guest-free-and-paid:2 @goal:guest-free-and-paid:6
Feature: How many spaces a person can host
  Guests and free accounts host one space at a time and Plus members host as
  many as they like, so hosting more is something worth paying for. Reaching
  the limit is an invitation to Plus, never an error.

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

    Scenario: A Plus member hosts a second space at once
      Given Alice has subscribed to Plus
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is in the space
      And Alice hosts 2 spaces
