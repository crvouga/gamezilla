/**
 * Steps entry for this package's features (`tests/*.feature`): registers the
 * engine world and every step definition the features use.
 */

import './server.steps';
import './client.steps';

import { useEngineWorld } from './world';

useEngineWorld();
