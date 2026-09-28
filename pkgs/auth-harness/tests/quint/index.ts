/**
 * Quint entry for this package's models (`specs/auth/*.qnt`): registers
 * the sign-in trace world and every model's binding.
 */

import './outside-accounts.binding';

import { useSignInTraceWorld } from './world';

useSignInTraceWorld();
