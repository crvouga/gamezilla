#!/bin/zsh
if ! grep -q 'display notification' "$HOME/.zshrc"; then
  cat >> "$HOME/.zshrc" <<'EOF'
alert() {
  osascript -e "display notification \"$1\" with title \"Terminal\" sound name \"Glass\""
}
EOF
fi
source "$HOME/.zshrc"
alert "Notifications enabled"