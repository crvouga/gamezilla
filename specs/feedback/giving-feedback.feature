@domain:feedback
Feature: Give actionable product feedback
  When a person sees a bug or an opportunity to improve the app, the team
  wants feedback with enough context, so they can reproduce the bug or
  understand the improvement.

  Rule: Support offers bugs, feature requests, gaps and polish
    No counter-example: every kind of feedback is available without signing in.

    Scenario: Support welcomes every kind of feedback
      Given the team's app is working
      When the team opens Support
      Then the team can describe a bug, a feature request, a gap or polish

  Rule: A bug needs what happened, what was expected and how to reproduce it

    Scenario: A complete bug gives the team enough information to reproduce it
      Given the team has described a bug saying "Hint stays loading" expecting "The hint appears" reproducing "Open a puzzle and ask for a hint"
      When the team sends the feedback
      Then the local feedback includes what happened, what was expected and the reproduction steps

    Scenario Outline: An incomplete bug explains what is needed
      Given the team has described a bug without <detail>
      When the team sends the feedback
      Then the team is told to provide <detail> before sending feedback
      And the feedback has not been saved locally

      Examples:
        | detail             |
        | what happened      |
        | what was expected  |
        | reproduction steps |

  Rule: Feature requests, gaps and polish need a description and an improvement

    Scenario Outline: Feedback beyond bugs reaches the team
      Given the team has described <kind> saying "Finding the move is difficult" improving "Make the last move easier to see"
      When the team sends the feedback
      Then the local feedback keeps its kind and intended improvement

      Examples:
        | kind            |
        | a feature request |
        | a gap           |
        | polish          |

    Scenario: An improvement without a description explains what is needed
      Given the team has described polish without a description
      When the team sends the feedback
      Then the team is told to provide a description before sending feedback
      And the feedback has not been saved locally

    Scenario: Feedback without an intended improvement explains what is needed
      Given the team has described a feature request without an improvement
      When the team sends the feedback
      Then the team is told to provide an improvement before sending feedback
      And the feedback has not been saved locally
