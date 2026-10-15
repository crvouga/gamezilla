# Room server lifecycle

Room hosts can fence shared work through `RoomServer.setAvailability(false)`
or the private room-service binding's `availability` operation. The operation
serializes with commands and commits the module's `availabilityChange` events
and effects through ordinary room storage. It is not a client command.

A host must await this operation before stopping shared work. Modules decide
what availability means; the example game retains each player's remaining
clock bank and cancels its deadline. Individual connection loss only changes
the roster and does not invoke this boundary.

An available host calls `setAvailability(true)`. Hydration also resumes a
previously fenced room after recovering its committed effects. The example
game arms a deadline relative to the resumed clock, preserving the retained
banks. This boundary requires a host signal; it does not detect an unannounced
process failure or infer its start time.
