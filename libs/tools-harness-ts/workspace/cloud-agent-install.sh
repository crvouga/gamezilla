#!/usr/bin/env bash
# Install the pinned toolchain on Ubuntu, Cursor Cloud, and macOS.
# Same tools and frozen Bun install as setup.sh, without git-config.sh:
# a cloud host sets core.hooksPath, and that script exits when any hook exists.
# No credentials are fetched.
#
# Re-running is a no-op when the checkout and the login profiles already match.
# Pins are published as symlinks in ~/.local/bin. A real binary, or a symlink
# outside a mise install (Homebrew, nvm), is left in place. Login bash reads
# ~/.profile; login zsh reads ~/.zprofile. Both source one shared file.
#
# Graphify, Serena, and Swift match CI (.github/actions/setup). Swift is lazy,
# so a normal mise install skips it on every OS. Override MISE_DISABLE_TOOLS
# to install the others.
set -euo pipefail
export MISE_DISABLE_TOOLS="${MISE_DISABLE_TOOLS:-pipx:graphifyy,pipx:serena-agent,swift}"
export ONNXRUNTIME_NODE_INSTALL="${ONNXRUNTIME_NODE_INSTALL:-skip}"
export TURBO_UI=false
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/system.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

cloud_agent_env_file() {
  printf '%s\n' "$HOME/.local/share/mise-pinned-tools.sh"
}

cloud_agent_write_env_file() {
  local dest tmp
  dest="$(cloud_agent_env_file)"
  mkdir -p "$(dirname "$dest")" "$HOME/.local/bin"
  tmp="$(mktemp "${TMPDIR:-/tmp}/mise-pinned.XXXXXX")"
  cat >"$tmp" <<'EOF'
# Rewritten in place by cloud-agent-install.sh. bash and zsh can both source it.
if [ -x "$HOME/.local/bin/mise" ]; then
  PATH="$HOME/.local/bin:${PATH:-/usr/bin:/bin}"
  export PATH
  eval "$("$HOME/.local/bin/mise" env --shell bash)"
fi
EOF
  if [ ! -f "$dest" ] || ! cmp -s "$tmp" "$dest"; then
    cat "$tmp" >"$dest"
  fi
  rm -f "$tmp"
}

# One hook per file. An older inline block with the same marker is replaced.
cloud_agent_profile_hook() {
  local file="$1" marker line tmp
  marker="# cursor-cloud mise tools"
  line='[ -f "$HOME/.local/share/mise-pinned-tools.sh" ] && . "$HOME/.local/share/mise-pinned-tools.sh"'
  mkdir -p "$(dirname "$file")"
  [ -f "$file" ] || : >"$file"
  if grep -F -q "$line" "$file"; then
    return 0
  fi
  tmp="$(mktemp "${TMPDIR:-/tmp}/profile.XXXXXX")"
  awk -v marker="$marker" '
    index($0, marker) == 1 { skip = 1; next }
    skip && ($0 ~ /^if / || $0 ~ /^  / || $0 == "fi" || $0 == "") { next }
    skip { skip = 0 }
    { print }
  ' "$file" >"$tmp"
  printf '\n%s\n%s\n' "$marker" "$line" >>"$tmp"
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

# mode sync: ~/.local/bin, replace symlinks so a new pin wins.
# mode fill: system bin dirs, only an empty name or a link we already made.
cloud_agent_link() {
  local source="$1" target="$2" mode="$3" dir current
  dir="$(dirname "$target")"
  [ -d "$dir" ] || return 0
  if [ -L "$target" ]; then
    current="$(readlink "$target" 2>/dev/null || true)"
    if [ "$current" = "$source" ]; then
      return 0
    fi
    if [ "$mode" = fill ]; then
      case "$current" in
        *"/mise/installs/"*) ;;
        *) return 0 ;;
      esac
    fi
  elif [ -e "$target" ]; then
    return 0
  fi
  if [ -w "$dir" ]; then
    ln -sfn "$source" "$target"
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo ln -sfn "$source" "$target"
  fi
}

cloud_agent_publish_name() {
  local source="$1" name="$2"
  [ -n "$source" ] && [ -x "$source" ] || return 0
  cloud_agent_link "$source" "$HOME/.local/bin/$name" sync
  cloud_agent_link "$source" "/usr/local/bin/$name" fill
  cloud_agent_link "$source" "/opt/homebrew/bin/$name" fill
}

cloud_agent_publish_tools() {
  local tool bin
  cloud_agent_write_env_file
  cloud_agent_profile_hook "$HOME/.profile"
  cloud_agent_profile_hook "$HOME/.zprofile"
  # Creating ~/.bash_profile makes bash skip ~/.profile. Only extend one
  # that already exists and does not already read ~/.profile.
  if [ -f "$HOME/.bash_profile" ] && ! grep -q '\.profile' "$HOME/.bash_profile"; then
    cloud_agent_profile_hook "$HOME/.bash_profile"
  fi
  if ! command -v mise >/dev/null 2>&1; then
    return 0
  fi
  for tool in bun node; do
    bin="$(mise which "$tool" 2>/dev/null || true)"
    cloud_agent_publish_name "$bin" "$tool"
  done
  if [ -x "$HOME/.local/bin/mise" ]; then
    cloud_agent_link "$HOME/.local/bin/mise" "/usr/local/bin/mise" fill
    cloud_agent_link "$HOME/.local/bin/mise" "/opt/homebrew/bin/mise" fill
  fi
}

workspace_quiet "mise install" workspace_system
workspace_warn_unmerged
if ! workspace_install_is_current; then
  workspace_install
fi
cloud_agent_publish_tools
echo "==> cloud agent install complete; start ./libs/tools-harness-ts/workspace/cloud-agent-start.sh"
