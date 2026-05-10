import { SpaceModule } from '@gamezilla/spaces/shared/space-module';
import { createDurableObjectAdapter } from '@gamezilla/room/server/adapters/durable-object';

/**
 * Durable Object: one instance per space topic (`idFromName(topic)`).
 * Authoritative real-time multiplayer state for a space, served by the
 * shared {@link createDurableObjectAdapter} factory using the
 * {@link SpaceModule} domain reducer.
 */
export default createDurableObjectAdapter({ module: SpaceModule });
