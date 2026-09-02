'use strict';

/**
 * Re-export the chess-board Skia mock so product sims and package tests stay
 * in sync (checkerboard + piece Images in report HTML frames).
 */
module.exports = require('../../pkgs/chess-board/jest-skia-mock.cjs');
