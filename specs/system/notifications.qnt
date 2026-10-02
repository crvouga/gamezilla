// @spec-interpretation
// Sources: specs/friends
// Request-source identity is independent of each recipient's inbox preferences.
// These flags are permanent under duplicate delivery; closing is asynchronous.
module notifications {
  import universe.* from "./universe"
  type NotificationKey = (int,int)
  type NotificationState = { rows: Set[NotificationKey], active: Set[NotificationKey], read: Set[NotificationKey], archived: Set[NotificationKey], dismissed: Set[NotificationKey] }
  pure val inboxInitial: NotificationState = { rows: Set(), active: Set(), read: Set(), archived: Set(), dismissed: Set() }
  pure def inboxPublish(s: NotificationState, key: NotificationKey, pending: bool): NotificationState =
    if (not(pending)) s else { ...s, rows: s.rows.union(Set(key)), active: s.active.union(Set(key)) }
  pure def inboxDeactivate(s: NotificationState, key: NotificationKey): NotificationState = { ...s, active: s.active.exclude(Set(key)) }
  pure def inboxInteract(s: NotificationState, key: NotificationKey, actor: int, kind: str): NotificationState =
    if (key._2 != actor or not(s.rows.contains(key))) s
    else { ...s, read: s.read.union(Set(key)),
      archived: if (kind == "archive") s.archived.union(Set(key)) else s.archived,
      dismissed: if (kind == "dismiss") s.dismissed.union(Set(key)) else s.dismissed }
  pure def inboxErase(s: NotificationState, actor: int): NotificationState = {
    rows: s.rows.filter(k => k._1 != actor and k._2 != actor),
    active: s.active.filter(k => k._1 != actor and k._2 != actor), read: s.read.filter(k => k._1 != actor and k._2 != actor),
    archived: s.archived.filter(k => k._1 != actor and k._2 != actor), dismissed: s.dismissed.filter(k => k._1 != actor and k._2 != actor),
  }
  pure def inboxValid(s: NotificationState): bool = and {
    s.active.subseteq(s.rows), s.read.subseteq(s.rows), s.archived.subseteq(s.read), s.dismissed.subseteq(s.read),
    s.rows.forall(k => k._1 != k._2 and PEOPLE.contains(k._1) and PEOPLE.contains(k._2)),
  }
}
