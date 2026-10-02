// @model-profile: local
// Alice moves the keyboard through all sixty-four squares in screen directions.
// Each orientation reverses the named-square direction; every edge stops travel.
// Space and a tap share selection and completion for the prepared e2 to e4 move.
// Other piece activation is outside this projection and follows chess legality.
// The activity chooses orientation and input availability before these examples;
// runtime authority is covered by the board lifecycle and options models.
// The behavior is identical offline. Offers are the most recent input's moves.
module board_keyboard {
  type KeyboardBoard = {orientation: str, file: int, rank: int, position: str,
    selected: bool, interactive: bool, offers: List[str]}
  var keyboardBoard: KeyboardBoard
  pure def _inside(n: int): int = if (n < 0) 0 else if (n > 7) 7 else n
  pure def _activate(s: KeyboardBoard, file: int, rank: int): KeyboardBoard = {
    val source = file == 4 and rank == 1
    val completes = not(source) and s.selected and s.interactive and s.position == "opening"
    { ...s, file: file, rank: rank,
      selected: source and s.interactive and s.position == "opening" and not(s.selected),
      position: if (completes) "moved" else s.position,
      offers: if (completes) ["e2 to e4"] else [] }
  }
  action init = {
    nondet orientation = Set("White", "Black").oneOf()
    nondet canMove = Set(false, true).oneOf()
    keyboardBoard' = {orientation: orientation, file: 4, rank: 1,
      position: "opening", selected: false, interactive: canMove, offers: []}
  }
  /// Arrow travel follows the displayed direction and stops at each edge.
  action moveKeyboard(direction: str): bool = all {
    Set("up", "down", "left", "right").contains(direction), keyboardBoard.interactive,
    {
      val s = keyboardBoard
      val forward = if (s.orientation == "White") 1 else -1
      val file = s.file + (if (direction == "right") forward else if (direction == "left") -forward else 0)
      val rank = s.rank + (if (direction == "up") forward else if (direction == "down") -forward else 0)
      keyboardBoard' = { ...s, file: _inside(file), rank: _inside(rank), offers: [] }
    },
  }
  /// Space selects, deselects or completes the prepared pawn move, and disabled input refuses it.
  action chooseKeyboardSquare = all {
    keyboardBoard.file == 4, Set(1, 3).contains(keyboardBoard.rank),
    keyboardBoard' = _activate(keyboardBoard, keyboardBoard.file, keyboardBoard.rank),
  }
  /// A tap on the prepared source or destination gives that named square the keyboard.
  action tapKeyboardSquare(rank: int): bool = all {
    Set(1, 3).contains(rank), keyboardBoard.interactive,
    keyboardBoard' = _activate(keyboardBoard, 4, rank),
  }
  action step = {
    nondet direction = Set("up", "down", "left", "right").oneOf()
    nondet rank = Set(1, 3).oneOf()
    any {moveKeyboard(direction), chooseKeyboardSquare, tapKeyboardSquare(rank)}
  }
  /// The keyboard never leaves a named square, including at reversed edges.
  val invKeyboardSquare = keyboardBoard.file >= 0 and keyboardBoard.file <= 7 and
    keyboardBoard.rank >= 0 and keyboardBoard.rank <= 7
  /// Only the prepared legal move is offered, once on completion.
  val invKeyboardMove = keyboardBoard.offers == [] or
    (keyboardBoard.position == "moved" and keyboardBoard.offers == ["e2 to e4"] and not(keyboardBoard.selected))
  /// Disabled input never selects a source or offers a move.
  val invKeyboardAuthority = not(keyboardBoard.interactive) implies
    (not(keyboardBoard.selected) and keyboardBoard.offers == [])
}
