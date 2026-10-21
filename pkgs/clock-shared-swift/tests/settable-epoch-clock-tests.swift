import ClockShared
import Testing

@Suite struct SettableEpochClockTests {
  @Test func startsWhereItIsTold() {
    let clock = SettableEpochClock(startMilliseconds: 1_700_000_000_000)
    #expect(clock.nowMilliseconds() == 1_700_000_000_000)
  }

  @Test func advancesOnlyWhenTold() throws {
    let clock = SettableEpochClock(startMilliseconds: 10)
    #expect(clock.nowMilliseconds() == 10)
    try clock.advance(by: 25)
    #expect(clock.nowMilliseconds() == 35)
  }

  @Test func refusesANegativeDelta() {
    let clock = SettableEpochClock(startMilliseconds: 10)
    #expect(throws: SettableEpochClock.MoveError.negativeDelta(-1)) {
      try clock.advance(by: -1)
    }
    #expect(clock.nowMilliseconds() == 10)
  }

  @Test func neverRunsBackwards() throws {
    let clock = SettableEpochClock(startMilliseconds: 100)
    try clock.set(to: 150)
    #expect(clock.nowMilliseconds() == 150)
    #expect(throws: SettableEpochClock.MoveError.backwards(from: 150, to: 149)) {
      try clock.set(to: 149)
    }
    #expect(clock.nowMilliseconds() == 150)
  }

  @Test func isUsableThroughTheProtocol() throws {
    let settable = SettableEpochClock(startMilliseconds: 0)
    let clock: any EpochClock = settable
    try settable.advance(by: 1_000)
    #expect(clock.nowMilliseconds() == 1_000)
  }
}
