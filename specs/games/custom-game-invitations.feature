@domain:games
Feature: Invite someone to a side of a custom game
  When a creator chooses another person for a side, that person wants to decide whether to play, so an invitation never makes someone a participant without their acceptance.

  Rule: Only someone in the space can be invited

    Scenario: The creator reserves the second side for someone in the space
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      When Alice invites Bob to the second side
      Then the second side is reserved for Bob

    Scenario: Someone outside the space cannot be invited to a side
      Given Alice is setting up a custom game
      When Alice invites Carol to the second side
      Then Alice is told the person must be in the space

  Rule: The invited person is shown the invitation and nobody outside the space is

    Scenario: The invited person sees the invitation
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      When Alice invites Bob to the second side
      Then Bob sees Alice's invitation to play the second side

    Scenario: A revoked invitation is no longer shown to the invited person
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Alice revokes the invitation to the second side
      Then Bob does not see Alice's invitation to play the second side

    Scenario: Someone outside the space is never shown the invitation
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      And Carol is outside Alice's space
      When Alice invites Bob to the second side
      Then Carol cannot see the custom game

  Rule: Only the invited person accepts their current invitation

    Scenario: An accepted invitation becomes a participant
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Bob accepts the invitation to the second side
      Then the second side is Bob
      And Bob is not ready for the custom game

    Scenario: Another person cannot accept the invitation
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      And Carol is in Alice's space
      When Carol accepts the invitation to the second side
      Then Carol is told that side is not their invitation

  Rule: Declining opens the reserved side

    Scenario: The invited person declines without becoming a participant
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Bob declines the invitation to the second side
      Then the second side is open

    Scenario: Declining cannot remove an accepted participant
      Given Alice is setting up a custom game with Bob on the second side
      When Bob declines the invitation to the second side
      Then Bob is told that side is not their invitation

  Rule: Revoking an invitation removes its offer

    Scenario: The creator revokes a waiting invitation
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Alice revokes the invitation to the second side
      Then the second side is open

    Scenario: A revoked invitation cannot be accepted
      Given Alice is setting up a custom game
      And Alice has revoked Bob's invitation to the second side
      When Bob accepts the invitation to the second side
      Then Bob is told that side is not their invitation

  Rule: Invitation races keep at most one participant on the side

    Scenario: Simultaneous acceptance and revocation keep one valid side
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Bob accepts the invitation to the second side while Alice revokes it
      Then the second side is either Bob or open
      And the second side has at most one participant

    Scenario: An invitation cannot survive replacement by a bot
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      And Alice has assigned a bot to the second side
      When Bob accepts the invitation to the second side
      Then Bob is told that side is not their invitation
