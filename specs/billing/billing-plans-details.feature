@domain:billing
Feature: What the billing plans tell a person
  When a person looks at the billing plans, they want to see what Plus costs
  and where their own membership stands, so they can decide what to do next
  without asking the team.

  Rule: Someone without a membership sees what each Plus plan costs and is offered a free trial
    No counter-example: a Plus member is never offered to subscribe, which "What the billing plans offer" shows.

    Scenario: A signed-in person without a membership sees both prices and a 7-day free trial
      Given Alice is signed in with Google
      When Alice views the billing plans
      Then Alice sees the monthly plan at $7.00 a month
      And Alice sees the yearly plan at $60.00 a year, $5.00 a month, saving 29%
      And Alice is offered a 7-day free trial

  Rule: While a membership is trialing, the billing plans show the day its free trial ends
    No counter-example: nothing a person does hides the day their own free trial ends.

    Scenario: A person on a free trial sees the day their free trial ends and the days left in the free trial
      Given Alice has subscribed to Plus
      And Alice has 5 days left in the free trial
      When Alice views the billing plans
      Then Alice sees their free trial ends in 5 days
      And Alice sees the day their free trial ends

  Rule: A Plus member sees the Plus plan they are on marked as their current plan, and only that one

    Background:
      Given Alice has subscribed to Plus

    Scenario: A Plus member on the monthly plan sees it marked as their current plan
      When Alice views the billing plans
      Then Alice sees the monthly plan marked as their current plan
      And Alice sees the yearly plan not marked as their current plan

    Scenario: A Plus member on the yearly plan sees it marked as their current plan
      Given Alice has switched the membership to the yearly plan in the billing portal
      When Alice views the billing plans
      Then Alice sees the yearly plan marked as their current plan
      And Alice sees the monthly plan not marked as their current plan

  Rule: A Plus member whose payment failed is told so and offered to pay with a new card

    Background:
      Given Alice has subscribed to Plus

    Scenario: A Plus member whose payment failed is told so on the billing plans
      Given Alice's payment has failed
      When Alice views the billing plans
      Then Alice is told their payment failed
      And Alice is offered to pay with a new card

    Scenario: A Plus member whose payments go through is not told a payment failed
      When Alice views the billing plans
      Then Alice is not told a payment failed
      And Alice is not offered to pay with a new card

  Rule: The billing plans tell a Plus member whose membership will not renew the last day of their paid access, grace included

    Background:
      Given Alice has subscribed to Plus

    @regression:billing-access-date-omits-grace
    Scenario: A Plus member who canceled sees their paid access lasts 7 days past the period end
      Given Alice has canceled the membership in the billing portal
      When Alice views the billing plans
      Then Alice sees their paid access lasts until 7 days after the period end

    Scenario: A Plus member whose payment failed sees their paid access lasts 7 days past the period end
      Given Alice's payment has failed
      When Alice views the billing plans
      Then Alice sees their paid access lasts until 7 days after the period end

    Scenario: A Plus member whose membership ended sees the last day of their paid access
      Given Alice has canceled the membership in the billing portal
      And Alice's billing period has ended
      When Alice views the billing plans
      Then Alice sees their paid access lasts until 7 days after the period end
      And Alice has paid access

    Scenario: A Plus member whose membership renews is not told a last day of paid access
      When Alice views the billing plans
      Then Alice is not told a last day of paid access
