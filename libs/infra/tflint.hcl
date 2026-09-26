config {
  call_module_type = "local"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Versions are constrained and locked by each root stack. Repeating them in
# local modules would create a second version policy to keep synchronized.
rule "terraform_required_providers" {
  enabled = false
}

rule "terraform_required_version" {
  enabled = false
}

# Every stack accepts the same checked-in environment object, while each stack
# deliberately consumes only its own slice of that shared schema.
rule "terraform_unused_declarations" {
  enabled = false
}
