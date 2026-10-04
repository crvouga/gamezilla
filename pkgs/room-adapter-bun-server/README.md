# `@pkgs/room-adapter-bun`

Hosts `@pkgs/room` rooms on a Bun WebSocket server.

Production runs rooms in a Cloudflare Durable Object: a single-threaded
authority addressed by topic. This adapter reproduces that shape for a
loopback stack — one `RoomServer` per `(topic, module)`, reached over a real
WebSocket speaking the same wire protocol `@pkgs/room-adapter-web-shared` already
speaks.

**Placement is the caller's job.** With several API instances behind a load
balancer, every socket for a topic must reach the same instance, exactly as
`idFromName(topic)` guarantees in production. The localhost stack's balancer
hashes the topic to do this.
