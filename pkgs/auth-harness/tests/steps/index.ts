/**
 * Steps entry for `specs/auth/` (this package's `specDomains`): the
 * parameter types, the world, and every step its features use.
 */

import './parameter-types';
import './sign-in.steps';

import { useSignInWorld } from './world';

useSignInWorld();
