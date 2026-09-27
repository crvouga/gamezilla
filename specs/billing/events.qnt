// What Billing tells the rest of the product.
//
// Other parts of the product only need to know when a person gains or loses
// paid access: a Plus member has what Plus offers, and a free account falls
// back to its limits. How a membership got there (a free trial, a renewal, a
// failed payment, grace running out, a refund) stays inside Billing.
module events {
  type Person = str

  type BillingEvent =
    // The person had free access and now has paid access.
    | PaidAccessStarted(Person)
    // The person had paid access and now has free access.
    | PaidAccessEnded(Person)
}
