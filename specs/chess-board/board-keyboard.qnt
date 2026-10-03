// @model-profile: local
// Alice moves the keyboard through all sixty-four squares in screen directions.
// Each orientation reverses the named-square direction; every edge stops travel.
// The initial entry square is a1 facing White or h8 facing Black. Space, Enter
// and a tap share selection and completion for e2 to e4 or g1 to f3.
// Other piece activation is outside this projection and follows chess legality.
// The activity chooses orientation and input availability before these examples;
// runtime authority is covered by the board lifecycle and options models.
// The behavior is identical offline. Offers are the most recent input's moves.
module board_keyboard {
  type KeyboardBoard = {orientation: str, file: int, rank: int, position: str,
    selectedSource: str, interactive: bool, offers: List[str]}
  var keyboardBoard: KeyboardBoard
  pure def _inside(n: int): int = if (n < 0) 0 else if (n > 7) 7 else n
  pure def _activate(s: KeyboardBoard, file: int, rank: int): KeyboardBoard = {
    val source = if (file == 4 and rank == 1) "e2"
      else if (file == 6 and rank == 0) "g1" else "none"
    val move = if (file == 4 and rank == 3 and s.selectedSource == "e2") "e2 to e4"
      else if (file == 5 and rank == 2 and s.selectedSource == "g1") "g1 to f3" else "none"
    val completes = move != "none" and s.interactive and s.position == "opening"
    { ...s, file: file, rank: rank,
      selectedSource: if (s.interactive and s.position == "opening" and
        source != "none" and source != s.selectedSource) source else "none",
      position: if (completes) move else s.position,
      offers: if (completes) [move] else [] }
  }
  pure def _preparedSquare(file: int, rank: int): bool =
    (file == 4 and Set(1, 3).contains(rank)) or
    (file == 6 and rank == 0) or (file == 5 and rank == 2)
  action init = {
    nondet orientation = Set("White", "Black").oneOf()
    nondet canMove = Set(false, true).oneOf()
    keyboardBoard' = {orientation: orientation,
      file: if (orientation == "White") 0 else 7, rank: if (orientation == "White") 0 else 7,
      position: "opening", selectedSource: "none", interactive: canMove, offers: []}
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
  /// Space or Enter selects, deselects or completes a prepared move; disabled input refuses it.
  action chooseKeyboardSquare(key: str): bool = all {
    Set("Space", "Enter").contains(key),
    _preparedSquare(keyboardBoard.file, keyboardBoard.rank) or not(keyboardBoard.interactive),
    keyboardBoard' = _activate(keyboardBoard, keyboardBoard.file, keyboardBoard.rank),
  }
  /// A tap on the prepared source or destination gives that named square the keyboard.
  action tapKeyboardSquare(file: int, rank: int): bool = all {
    _preparedSquare(file, rank), keyboardBoard.interactive,
    keyboardBoard' = _activate(keyboardBoard, file, rank),
  }
  action step = {
    nondet direction = Set("up", "down", "left", "right").oneOf()
    nondet file = Set(4, 5, 6).oneOf()
    nondet rank = Set(0, 1, 2, 3).oneOf()
    nondet key = Set("Space", "Enter").oneOf()
    any {moveKeyboard(direction), chooseKeyboardSquare(key), tapKeyboardSquare(file, rank)}
  }
  /// The keyboard never leaves a named square, including at reversed edges.
  val invKeyboardSquare = keyboardBoard.file >= 0 and keyboardBoard.file <= 7 and
    keyboardBoard.rank >= 0 and keyboardBoard.rank <= 7
  /// Only a prepared legal move is offered, once on completion.
  val invKeyboardMove = Set("opening", "e2 to e4", "g1 to f3").contains(keyboardBoard.position) and
    Set("none", "e2", "g1").contains(keyboardBoard.selectedSource) and
    (keyboardBoard.offers == [] or (keyboardBoard.position != "opening" and
      keyboardBoard.offers == [keyboardBoard.position] and keyboardBoard.selectedSource == "none"))
  /// Disabled input never selects a source or offers a move.
  val invKeyboardAuthority = not(keyboardBoard.interactive) implies
    (keyboardBoard.selectedSource == "none" and keyboardBoard.offers == [])
}
