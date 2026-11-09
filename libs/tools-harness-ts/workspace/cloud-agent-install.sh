#!/usr/bin/env bash
# Cursor Cloud Agent install. Same pinned tools and frozen dependency install
# as setup.sh, without git-config.sh: the agent host sets core.hooksPath, and
# that script exits when any hook is present. No credentials are fetched.
#
# Graphify, Serena, and Swift match CI (.github/actions/setup). They are not
# required to run the product, and Swift is a large lazy toolchain.
set -euo pipefail
export MISE_DISABLE_TOOLS="${MISE_DISABLE_TOOLS:-pipx:graphifyy,pipx:serena-agent,swift}"
export ONNXRUNTIME_NODE_INSTALL="${ONNXRUNTIME_NODE_INSTALL:-skip}"
export TURBO_UI=false
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
. "$(dirname "${BASH_SOURCE[0]}")/system.sh"
. "$(dirname "${BASH_SOURCE[0]}")/install.sh"

cloud_agent_publish_tools() {
  # Tests pass CLOUD_AGENT_BIN_DIR. Agents publish onto the default PATH.
  local tool bin dest="${CLOUD_AGENT_BIN_DIR:-/usr/local/bin}"
  mkdir -p "$HOME"
  if command -v mise >/dev/null 2>&1; then
    for tool in bun node; do
      bin="$(mise which "$tool" 2>/dev/null || true)"
      if [ -n "$bin" ] && [ -x "$bin" ]; then
        cloud_agent_link "$bin" "$dest/$tool"
      fi
    done
    if [ -x "$HOME/.local/bin/mise" ]; then
      cloud_agent_link "$HOME/.local/bin/mise" "$dest/mise"
    fi
  fi
  # nvm in ~/.profile is sourced after /etc/profile.d and would hide the pin.
  local marker="# cursor-cloud mise tools"
  touch "$HOME/.profile"
  if ! grep -q "$marker" "$HOME/.profile"; then
    cat >>"$HOME/.profile" <<'EOF'

# cursor-cloud mise tools
if [ -x /usr/local/bin/mise ]; then
  export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
  eval "$(MISE_OFFLINE=1 MISE_AUTO_INSTALL=0 /usr/local/bin/mise env --shell bash)"
fi
EOF
  fi
}

cloud_agent_link() {
  local source="$1" target="$2"
  mkdir -p "$(dirname "$target")"
  if [ -w "$(dirname "$target")" ]; then
    ln -sfn "$source" "$target"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo ln -sfn "$source" "$target"
  fi
}

workspace_quiet "mise install" workspace_system
workspace_warn_unmerged
if ! workspace_install_is_current; then
  workspace_install
fi
cloud_agent_publish_tools
echo "==> cloud agent install complete; start ./libs/tools-harness-ts/workspace/cloud-agent-start.sh"
