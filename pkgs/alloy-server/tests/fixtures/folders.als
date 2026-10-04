/* Folders: a tree under one root, owned by users, some of them shared. */
abstract sig User { name: lone Name }
sig Admin, Guest extends User {}
sig Name {}
one sig Root { top: set Folder }
sig Folder {
  parent: lone Folder,
  owner: one User,
  perms: User -> Name
}
sig Shared in Folder {}
sig Tag { name: one Name }

fact NoCycles { no f: Folder | f in f.^parent }
fact TopHasNoParent { all f: Root.top | no f.parent }

assert Acyclic { no f: Folder | f in f.^parent }
check Acyclic for 4
