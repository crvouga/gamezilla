/**
 * Quint entry for this package's models (`specs/sign-in/*.qnt`): registers
 * the sign-in trace world and every model's binding.
 */

import './outside-accounts.binding';

import { useSignInTraceWorld } from './world';

useSignInTraceWorld();
