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
 * The tileset is kept whole, as the loaded image, and tiles are drawn straight out of it. Upstream instead cut the
 * image into 1,024 separate Images at startup, by painting each tile onto a canvas and reading it back as a data
 * URI. That cost a second or so and 1,024 live images per tileset, twice over, and it could not run at all from a
 * file:// URL, where reading back a canvas painted with a local image throws — which is why upstream carried a
 * copy of both tilesets as base64 data URIs to fall back on. Drawing from the atlas needs neither.
 */

import { TILE_COUNT } from "./tileValues.ts";

// Tiles must be 16px square
var TILE_SIZE = 16;
var TILES_PER_ROW = Math.sqrt(TILE_COUNT);
var ACCEPTABLE_DIMENSION = TILES_PER_ROW * TILE_SIZE;


// Where a tile sits in the atlas.
function tileSource(tileVal) {
  return {
    x: (tileVal % TILES_PER_ROW) * TILE_SIZE,
    y: Math.floor(tileVal / TILES_PER_ROW) * TILE_SIZE,
  };
}


function TileSet(image, callback, errorCallback) {
  if (!(this instanceof TileSet))
    return new TileSet(image, callback, errorCallback);

  if (callback === undefined || errorCallback === undefined) {
    if (callback === undefined && errorCallback === undefined)
      throw new Error('Tileset constructor called with no callback or errorCallback');
    else
      throw new Error('Tileset constructor called with no ' + (callback === undefined ? 'callback' : 'errorCallback'));
  }

  this.isValid = false;
  this.tileWidth = TILE_SIZE;
  this._image = null;

  if (!(image instanceof Image)) {
    // Spin the event loop
    window.setTimeout(errorCallback, 0);
    return;
  }

  // An image the page is still fetching has no dimensions to check yet: wait for it rather than calling it invalid.
  if (image.complete) {
    this._verifyImage(image, callback, errorCallback);
    return;
  }

  var self = this;
  var done = function(handler) {
    return function() {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      handler();
    };
  };
  var onLoad = done(function() { self._verifyImage(image, callback, errorCallback); });
  var onError = done(function() { window.setTimeout(errorCallback, 0); });

  image.addEventListener('load', onLoad);
  image.addEventListener('error', onError);
}


TileSet.prototype._verifyImage = function(image, callback, errorCallback) {
  // We expect tilesets to be square, and of the required width/height
  if (image.width !== image.height || image.width !== ACCEPTABLE_DIMENSION) {
    // Spin the event loop
    window.setTimeout(errorCallback, 0);
    return;
  }

  this._image = image;
  this.isValid = true;
  // Spin the event loop
  window.setTimeout(callback, 0);
};


TileSet.prototype.drawTile = function(ctx, tileVal, destX, destY, destSize) {
  var size = destSize === undefined ? TILE_SIZE : destSize;
  var source = tileSource(tileVal);
  ctx.drawImage(this._image, source.x, source.y, TILE_SIZE, TILE_SIZE, destX, destY, size, size);
};


export { TileSet, tileSource, TILE_SIZE, TILES_PER_ROW, ACCEPTABLE_DIMENSION };
