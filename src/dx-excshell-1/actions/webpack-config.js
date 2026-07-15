/*
* <license header>
*/

/**
 * Webpack overrides for the Adobe I/O Runtime action bundler.
 *
 * Workaround for a webpack module-concatenation (scope hoisting) crash in the
 * aio action builder: "Self-reference dependency has unused export name: This
 * should not happen", thrown while bundling some actions whose transitive
 * dependencies (e.g. debug via axios) hit the faulty code path under Node 24.
 * Disabling `concatenateModules` avoids scope hoisting and the crash.
 *
 * aio-lib-runtime discovers this file by walking up from each action directory
 * and merges it on top of its required action defaults (entry / output /
 * target / mode / resolve / plugins, and it defaults optimization.minimize),
 * so only the option set here is changed.
 */
module.exports = {
  optimization: {
    // Scope hoisting is what emits the faulty self-reference dependency.
    concatenateModules: false,
    // The crash surfaces from used/provided-export analysis on a self-referencing
    // CommonJS module; turning it off removes the faulty code path. Tree-shaking
    // is not needed for a Node Runtime action bundle.
    usedExports: false,
    providedExports: false,
    sideEffects: false
  }
}
