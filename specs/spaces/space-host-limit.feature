@domain:spaces
Feature: How many spaces a person can host
  When a person already hosts as many spaces as their hosting limit allows and
  wants another, they want to be invited to Plus rather than stopped by an
  error, so hosting more is something worth paying for.

  Rule: Guests and free accounts host one space at a time

    Scenario: A free account hosting a space is invited to Plus to host another
      Given Alice is signed in
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is told their hosting limit is reached and invited to get Plus
      And Alice hosts 1 space

    Scenario: A guest hosting a space is invited to Plus to host another
      Given Alice is a guest
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is told their hosting limit is reached and invited to get Plus
      And Alice hosts 1 space

    Scenario: After paid access ends, Alice is invited to Plus to host another space
      Given Alice is a Plus member
      And Alice is hosting a space
      And Alice's paid access has ended
      When Alice creates another space
      Then Alice is told their hosting limit is reached and invited to get Plus
      And Alice hosts 1 space

    Scenario: Ending a space frees the place for a new one
      Given Alice is signed in
      And Alice has hosted a space and ended it
      When Alice creates a space
      Then Alice is in the space
      And Alice is not invited to get Plus

  Rule: Plus members never reach a hosting limit
    No counter-example: paid access has no maximum number of hosted spaces.

    Scenario: A Plus member hosts a second space at once
      Given Alice is a Plus member
      And Alice is hosting a space
      When Alice creates another space
      Then Alice is in the space
      And Alice hosts 2 spaces

  Rule: Paid access ending keeps existing spaces and applies the free hosting limit to new spaces

    Scenario: A host keeps two spaces when paid access ends
      Given Alice is a Plus member
      And Alice is hosting 2 spaces
      And Alice's paid access has ended
      When Alice returns to their space
      Then Alice is in the space
      And Alice hosts 2 spaces

    Scenario: A host with two retained spaces cannot create a third without paid access
      Given Alice is a Plus member
      And Alice is hosting 2 spaces
      And Alice's paid access has ended
      When Alice creates another space
      Then Alice is told their hosting limit is reached and invited to get Plus
      And Alice hosts 2 spaces

    Scenario: An offline host keeps using a space after paid access ends
      Given Alice is a Plus member
      And Alice is hosting 2 spaces
      And Alice's paid access has ended
      And Alice is offline
      When Alice returns to their space
      Then Alice is in the space

    Scenario: Someone still joins a retained space after its host's paid access ends
      Given Alice is a Plus member
      And Alice is hosting 2 spaces
      And Alice's paid access has ended
      When Bob joins the space from the link
      Then Bob is in the space
      And Alice sees 2 people in the space within 20 seconds
