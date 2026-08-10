// @io-wall-ok
/**
 * Infra CLI composition root — single wall {@link Io} for the process.
 * Import {@link cliIo} from helpers instead of calling wallIo() again.
 */
import { wallIo } from '@pkgs/io';

export const cliIo = wallIo();
