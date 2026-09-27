// The published language of Spaces: what other contexts may learn about live
// spaces.
//
// A space opens when its host creates it. People join it and leave it while
// it is open, and it ends when its host ends it or leaves. Every event names
// the host, since a person hosts a space and everyone else is in the host's
// space. These are facts Spaces has already decided; other contexts react to
// them (a friend shows as live while in an open space, a space plays a
// puzzle) and never ask Spaces for them.
module events {
  type Person = str

  type SpaceEvent =
    // A host created a space, and it is open.
    | SpaceOpened({ host: Person })
    // A person joined the host's open space.
    | PersonJoined({ person: Person, host: Person })
    // A person left the host's space for good.
    | PersonLeft({ person: Person, host: Person })
    // The host's space ended for everyone in it.
    | SpaceEnded({ host: Person })
}
