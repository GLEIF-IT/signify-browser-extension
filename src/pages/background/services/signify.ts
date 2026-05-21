export { signifyConnectionService } from "./signify-connection";
export { signifyOperationsService } from "./signify-operations";

import { signifyConnectionService } from "./signify-connection";
import { signifyOperationsService } from "./signify-operations";

/**
 * Combined service used by all background handlers.
 * Preserves the original API surface — importers of signifyService do not need to change.
 */
export const signifyService = {
  ...signifyConnectionService,
  ...signifyOperationsService,
};
