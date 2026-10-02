// What Identity tells the rest of the product.
//
// Other parts of the product need to know three things about who a person
// is: that they signed in on a device (a guest now has an account there),
// that they signed out on a device, and that they changed their username (so
// everyone else shows the new one). How they got there (which sign-in method,
// an address match, signing out everywhere, a refused username change) stays
// inside Identity. Signing out everywhere is a sign out on each device. These
// are facts Identity has already decided; other contexts react to them and
// never look inside its models.
module events {
  type Person = str
  type Device = str
  type Username = str

  /// A fact about who a person is, already settled.
  type IdentityEvent =
    // The person signed in to their account on this device.
    | SignedIn({ person: Person, device: Device })
    // The person's account signed out on this device.
    | SignedOut({ person: Person, device: Device })
    // The person renamed themselves; everyone now sees this username.
    | UsernameChanged({ person: Person, username: Username })
    // Account deletion was confirmed; other people must no longer see or use it.
    | AccountDeletionConfirmed(Person)
}
