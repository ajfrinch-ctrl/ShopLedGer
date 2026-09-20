import { copyFileSync, writeFileSync } from "node:fs";

// GitHub Pages has no rewrite rules. Serve the same hydrated SPA shell when
// someone opens or reloads a nested route, including /customers/:id.
copyFileSync("dist/client/index.html", "dist/client/404.html");
writeFileSync("dist/client/.nojekyll", "");
