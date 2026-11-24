declare const require: (path: string) => number;

/** Brand images bundled by Metro. Kept in one module so screens do not repeat asset paths. */
export const BRAND_LOGO = require("../assets/branding/certichain-logo.png");
export const BRAND_MARK = require("../assets/branding/certichain-isotipo.png");
export const APP_VERSION = "1.0.0";
