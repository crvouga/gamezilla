@domain:games
Feature: Turn reminders in a daily game
  When a person's time for a move in their daily game is nearly used up, they want their turn notice to come back as a turn reminder, so they do not run out of time over a move they forgot.

  Rule: When the clock of the person to move in a daily game becomes low on time, their turn notice comes back unread as a turn reminder with the time they have left

    Scenario Outline: At <clock choice> per move a turn notice opened earlier comes back as an unread turn reminder with <left> left
      Given Alice has the first side against Bob in a daily game at <clock choice> per move after their first moves
      And Alice has opened her turn notice
      When <time> pass
      Then Alice's inbox shows one unread turn reminder with <left> left for their daily game with Bob within 15 seconds

      Examples:
        | clock choice | time     | left    |
        | 1 day        | 18 hours | 6 hours |
        | 3 days       | 2 days   | 1 day   |
        | 7 days       | 6 days   | 1 day   |

    Scenario: A person with an hour more than 1 day left at 3 days per move gets no turn reminder
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And Alice has opened her turn notice
      When 47 hours pass
      Then Alice's inbox still shows no turn reminder after 15 seconds
      And Alice's turn notice is no longer unread

  Rule: A person gets one turn reminder per turn, and only the person to move in an unfinished daily game gets one

    Scenario: A turn reminder a person has opened does not come back on the same turn
      Given Alice opened her turn reminder with 1 day left in her daily game at 3 days per move with Bob
      When 12 hours pass
      Then Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds
      And Alice's turn notice is no longer unread

    Scenario: A later turn brings a turn reminder of its own
      Given Alice got a turn reminder on an earlier turn of her daily game at 3 days per move with Bob, and it is her turn again
      When 2 days pass
      Then Alice's inbox shows one unread turn reminder with 1 day left for their daily game with Bob within 15 seconds

    Scenario: The person who has already moved gets no turn reminder
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      When 2 days pass
      Then Bob's inbox still shows no turn notice after 15 seconds

    Scenario: A daily game that is already over gives no turn reminder later
      Given Alice has a result notice of a daily game won against Bob
      When 7 days pass
      Then Alice's inbox still shows no turn notice after 15 seconds
      And Bob's inbox still shows no turn notice after 15 seconds

    Scenario: A matched game that is not a daily game gives no turn reminder
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      When 50 seconds pass
      Then Alice's inbox still shows no turn notice after 15 seconds

  Rule: A turn reminder is the person's one turn notice: it leaves the inbox as a turn notice does, and a person who was not using the app finds it when they are back

    Scenario: A turn reminder for the first move takes the place of the turn notice instead of joining it
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When 2 days pass
      Then Alice's inbox shows one unread turn reminder with 1 day left for their daily game with Bob within 15 seconds
      And Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds

    Scenario: A person's own accepted move removes their turn reminder from the inbox
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And 2 days have passed
      When Alice makes her first move
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A daily game that is over takes the turn reminder out of the inbox
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And 2 days have passed
      When Bob resigns the matched game
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: An aborted daily game takes the turn reminder out of the inbox
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And 2 days have passed
      When Bob aborts the matched game
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A person whose phone was offline finds their turn reminder once it is back online
      Given Alice's phone was offline when her turn notice became a turn reminder with 1 day left in her daily game at 3 days per move with Bob
      When the connection comes back
      Then Alice's inbox shows one unread turn reminder with 1 day left for their daily game with Bob within 15 seconds
