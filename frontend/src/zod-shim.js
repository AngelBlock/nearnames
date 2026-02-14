// Shim for zod that avoids Parcel v2 bug with `export default <namespace import>`.
// Zod v4's index.js does `import * as z from ...; export default z;` which Parcel
// can't resolve. Since only `import { z } from "zod"` is used (by @meteorwallet/sdk),
// we re-export everything except the broken default.
import * as z from "../node_modules/zod/v4/classic/external.js";
export * from "../node_modules/zod/v4/classic/external.js";
export { z };
