@domain:profile
Feature: Finish signing in
  When signing in takes a while to finish, a person wants the app to
  show them signed in only once it shows their account, so nothing they do
  right after signing in lands anywhere but their account.

  Rule: A device shows a person signed in only once it shows their account
    No counter-example: nothing a person does makes a device show them signed in sooner.

    Scenario: A new device that shows Alice signed in already shows the account's username
      Given Alice is signed in
      And Alice's username is @alice_laptop
      And signing in takes 10 seconds to finish on Alice's other device
      When Alice's account opens on another device
      Then Alice's other device shows @alice_laptop
