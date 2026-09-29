// Accounts, the outside accounts that sign into them, and the devices signed
// into them, at any one moment.
//
// Everyone has a profile: their username and their avatar. A guest's profile
// is their own; once they sign in it goes with their account. An account is
// signed into with its sign-in methods: Google or Apple, each through one
// outside account, a Google account or an Apple account. A device is signed
// into one account or none; the devices on an account are those signed into
// it.
//
// What this does not say: that usernames are saved in lowercase and unique in
// any letter case, which is about the words themselves; and that the last
// sign-in method cannot be removed, which is about what a person does. An
// account whose only Apple account was deleted at Apple can be left with no
// sign-in method, and then no device is signed into it.

sig Username {}

sig Avatar {}

sig Profile {
  // the name the person goes by
  username: one Username,
  // the picture on the profile
  avatar: one Avatar
}

sig Account {
  // the profile that goes with the account to every device
  profile: one Profile
}

abstract sig OutsideAccount {
  // the account in the app this outside account signs into, if any
  signsInto: lone Account
}

// a person's own account with Google
sig GoogleAccount extends OutsideAccount {}

// a person's own account with Apple
sig AppleAccount extends OutsideAccount {}

sig Device {
  // the account this device is signed into, if any
  account: lone Account
}

// No two people have the same username.
fact UsernamesAreUnique {
  all u: Username | lone username.u
}

// A profile belongs to one account at most.
fact OneAccountPerProfile {
  all p: Profile | lone profile.p
}

// An account has at most one Google account and at most one Apple account signing into it.
fact OneOfEachSignInMethod {
  all a: Account | lone (GoogleAccount & signsInto.a) and lone (AppleAccount & signsInto.a)
}

// A device is only signed into an account that still has a sign-in method.
fact SignedIntoAccountsWithASignInMethod {
  all d: Device | some d.account implies some signsInto.(d.account)
}

// No two accounts show the same username.
assert NoTwoAccountsShareAUsername {
  all disj a, b: Account | a.profile.username != b.profile.username
}
check NoTwoAccountsShareAUsername for 5

// Every account a device is signed into can be signed into again with Google or with Apple.
assert SignedInAccountsCanBeSignedIntoAgain {
  all d: Device | some d.account implies
    (some GoogleAccount & signsInto.(d.account) or some AppleAccount & signsInto.(d.account))
}
check SignedInAccountsCanBeSignedIntoAgain for 5

// An outside account never signs into two accounts.
assert OutsideAccountsSignIntoOneAccount {
  all o: OutsideAccount | lone o.signsInto
}
check OutsideAccountsSignIntoOneAccount for 5

// A world with an account signed in on two devices, with both Google and Apple, beside a guest.
run {
  some a: Account {
    some GoogleAccount & signsInto.a
    some AppleAccount & signsInto.a
    some disj d, e: Device | d.account = a and e.account = a
  }
  some p: Profile | no profile.p
} for 3 expect 1
