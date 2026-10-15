@domain:chess
Feature: Stop adding puzzles
  When the team needs to stop adding puzzles, they want to keep the puzzles
  already added, so solvers can carry on and the team can start again later.

  Rule: Only the team may stop an ongoing addition

    Scenario: Stopping keeps the puzzles already added
      Given Alice is on the team for this environment
      And this environment has added some puzzles and is adding more
      When Alice tries to stop adding puzzles to this environment
      Then Alice sees that this environment stopped adding puzzles
      And the puzzles already added remain available to solvers

    Scenario: A person outside the team cannot stop an addition
      Given Alice is signed in and not on the team for this environment
      And this environment is adding puzzles
      When Alice tries to stop adding puzzles to this environment
      Then Alice is told only the team can add or stop adding puzzles
      And this environment is still adding puzzles

  Rule: Stopping is offered only while puzzles are being added

    Scenario: The team is offered to stop an ongoing addition
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When Alice follows adding puzzles to this environment
      Then Alice is offered to stop adding puzzles

    Scenario Outline: The team is not offered to stop an addition that is not ongoing
      Given Alice is on the team for this environment
      And this environment <state>
      When Alice follows adding puzzles to this environment
      Then Alice is not offered to stop adding puzzles

      Examples:
        | state                       |
        | is ready to add puzzles      |
        | finished adding puzzles     |
        | failed to add puzzles       |
        | stopped adding puzzles      |

  Rule: A stopped addition can be started again
    No counter-example: a stopped addition no longer prevents the team from starting again.

    Scenario: A new addition can start after a stop
      Given Alice is on the team for this environment
      And this environment stopped adding puzzles
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles

  Rule: Starting and stopping need a connection

    Scenario: A connected team can start adding puzzles
      Given Alice is on the team for this environment
      And this environment is ready to add puzzles
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles

    Scenario: An offline start is refused without adding puzzles later
      Given Alice is on the team for this environment
      And Alice is offline
      When Alice tries to add puzzles to this environment
      Then Alice is told a connection is needed to add puzzles
      And this environment is not adding puzzles

    Scenario: An offline stop leaves an ongoing addition alone
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      And Alice is offline
      When Alice tries to stop adding puzzles to this environment
      Then Alice is told a connection is needed to stop adding puzzles
      And this environment is still adding puzzles

  Rule: Stopping needs confirmation and preserves the current result

    Scenario: Asking to stop does not stop an addition before confirmation
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When Alice asks to stop adding puzzles
      Then Alice is asked to confirm stopping adding puzzles
      And this environment is still adding puzzles

    Scenario: Cancelling the stop leaves puzzles being added
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping adding puzzles
      When Alice cancels stopping adding puzzles
      Then this environment is still adding puzzles
      And Alice is not asked to confirm stopping adding puzzles

    Scenario: Confirmation stops the addition while keeping accepted puzzles
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping adding puzzles
      When Alice confirms stopping adding puzzles
      Then Alice sees that this environment stopped adding puzzles
      And the puzzles already added remain available to solvers

    Scenario: An unfinished stop cannot be confirmed a second time
      Given Alice is on the team for this environment
      And Alice has confirmed stopping and the stop has not finished
      When Alice follows adding puzzles to this environment
      Then Alice is told adding puzzles is being stopped
      And Alice is not offered to confirm stopping adding puzzles again

    Scenario: Finishing a confirmed stop keeps the accepted puzzles available
      Given Alice is on the team for this environment
      And Alice has confirmed stopping and the stop has not finished
      When stopping adding puzzles finishes
      Then Alice sees that this environment stopped adding puzzles
      And the puzzles already added remain available to solvers

    Scenario: A failed stop can be tried again while the addition continues
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping adding puzzles
      When stopping adding puzzles fails
      Then Alice is told adding puzzles could not be stopped and why
      And Alice is offered to confirm stopping adding puzzles again
      And this environment is still adding puzzles

    Scenario: Finishing before confirmation keeps the finished result
      Given Alice is on the team for this environment
      And adding puzzles finished while Alice was being asked to confirm stopping
      When Alice confirms stopping adding puzzles
      Then Alice sees that this environment finished adding puzzles
      And the puzzles already added remain available to solvers

    Scenario: Confirmation while offline keeps the addition running
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping adding puzzles
      And Alice is offline
      When Alice confirms stopping adding puzzles
      Then Alice is told a connection is needed to stop adding puzzles
      And this environment is still adding puzzles
