/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 * Modified for Nation Builder (Flashpoint History), 2026 — see NOTICE.md.
 *
 */

import $ from "jquery";

import { Config } from './config.js';
import { startNationBuilder } from './nb/main.jsx';
import { TileSet } from './tileSet.js';

/*
 *
 * Our task in main is to load the tile image, create a TileSet from it, and then tell the SplashScreen to display
 * itself. We will never return here.
 *
 */


var tileSet, snowTileSet;


var onTilesLoaded = function() {
  // Nation Builder: upstream asked for [1] of a one-element set, so the snow tileset was always undefined here and
  // the game fell back to the base64 copy. There is no fallback now, so this has to name the image it means.
  snowTileSet = new TileSet($('#snowtiles')[0], onAllTilesLoaded, tileSetError);
};


var onAllTilesLoaded = function() {
  // Kick things off properly
  var sprites = $('#sprites')[0];
  if (sprites.complete) {
    $('#loadingBanner').css('display', 'none');
    // Nation Builder: the teaching layer's opening screens replace the upstream splash screen.
    startNationBuilder({tileSet: tileSet, snowTileSet: snowTileSet, spriteSheet: sprites});
  } else {
     window.setTimeout(onAllTilesLoaded, 0);
  }
};


// Nation Builder: said in the student's words, in the banner they are already looking at, in place of upstream's
// alert() and the base64 tilesets it fell back to.
var tileSetError = function() {
  $('#loadingBanner').text('The game\u2019s pictures didn\u2019t load. Reload the page to try again.').css('display', '');
};


// Check for debug parameter in URL
Config.debug = window.location.search.slice(1).split('&').some(function(param) {
  return param.trim().toLowerCase() === 'debug=1';
});


tileSet = new TileSet($('#tiles')[0], onTilesLoaded, tileSetError);
