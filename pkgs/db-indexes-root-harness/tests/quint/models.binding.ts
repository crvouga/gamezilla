import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { interruptionBinding } from './interruption';
import { retirementBinding } from './retirement';

bindQuintModel(retirementBinding);
bindQuintModel(interruptionBinding);
