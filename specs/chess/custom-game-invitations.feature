@domain:chess
Feature: Offer and accept a side
  When a creator chooses another person, that person wants to decide whether to play, so an invitation never gives someone control without their acceptance.

  Rule: Only someone in the space can be invited

    Scenario: The creator reserves Black for someone in the space
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      When Alice invites Bob to Black in the Custom Game
      Then Black is reserved for Bob in the Custom Game

    Scenario: An outsider cannot be assigned a side
      Given Alice has a configuring Custom Game
      When Alice invites Carol to Black in the Custom Game
      Then Alice is told the person must be in the space

  Rule: The invited person is shown the invitation and nobody outside the space is

    Scenario: The invited person sees the invitation
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      When Alice invites Bob to Black in the Custom Game
      Then Bob sees Alice's invitation to play Black

    Scenario: A revoked invitation is no longer shown to the invited person
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Alice revokes Black in the Custom Game
      Then Bob does not see Alice's invitation to play Black

    Scenario: An outsider is never shown the invitation
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      And Carol is outside Alice's space
      When Alice invites Bob to Black in the Custom Game
      Then Carol cannot see the Custom Game

  Rule: Only the invited person accepts their current invitation

    Scenario: An accepted invitation becomes a participant
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Bob accepts Black in the Custom Game
      Then Black is Bob in the Custom Game
      And Bob is not ready for the Custom Game

    Scenario: Another person cannot accept the invitation
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      And Carol is in Alice's space
      When Carol accepts Black in the Custom Game
      Then Carol is told that side is not their invitation

  Rule: Declining releases the reserved side

    Scenario: The invitee declines without becoming a participant
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Bob declines Black in the Custom Game
      Then Black is an open place in the Custom Game

    Scenario: Declining cannot remove an accepted participant
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Bob declines Black in the Custom Game
      Then Bob is told that side is not their invitation

  Rule: Revoking an invitation removes its offer

    Scenario: The creator revokes a waiting invitation
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Alice revokes Black in the Custom Game
      Then Black is an open place in the Custom Game

    Scenario: A revoked invitation cannot be accepted
      Given Alice has a configuring Custom Game
      And Bob's invitation to Black has been revoked
      When Bob accepts Black in the Custom Game
      Then Bob is told that side is not their invitation

  Rule: Invitation races retain only one valid side relationship

    Scenario: Simultaneous acceptance and revocation leave one valid side
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Bob accepts Black while Alice revokes its invitation
      Then Black is either Bob or an open place in the Custom Game
      And Black has at most one participant

    Scenario: An invitation cannot survive replacement by a bot
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      And Black has since been replaced by a bot
      When Bob accepts Black in the Custom Game
      Then Bob is told that side is not their invitation
