/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise = require('promise');
const drawGeoJSON = require('./geojson');
const {projection, tileUrl} = require('./proj');
const util = require('./util');
const getImg = Promise.denodeify(util.img);

const printlet = function(tilejson) {
  const proj = projection(tilejson);
  const tileSize = 256;
  let providerIndex = 0;
  const providers = (Array.from(tilejson.tiles).map((tmpl) => tileUrl(tmpl)));

  return Promise.nodeify(function(opt) {
    let {width, height, zoom, lng, lat, geojson, format, canvas} = opt;
    const location = {x:lng, y:lat};
    if (canvas != null) {
      canvas.width = width;
      canvas.height = height;
    } else {
      canvas = util.canvas(width, height);
    }
    const ctx = canvas.getContext('2d');

    const centerCoordinate = proj.project(location, zoom);

    const pointCoordinate = point =>
      // Return projected map coordinate reflecting pixel points from map center
      ({
        x: centerCoordinate.x + (point.x - (width/2)),
        y: centerCoordinate.y + (point.y - (height/2))
      })
    ;

    const coordinatePoint = coord =>
      // Return an x, y point on the map image for a given coordinate
      ({
        x: ((width / 2) + (coord.x)) - centerCoordinate.x,
        y: ((height / 2) + (coord.y)) - centerCoordinate.y
      })
    ;

    const pointTile = function(point) {
      // Return tile coordinate reflecting pixel points from map center
      const coord = pointCoordinate(point);
      return {
        x: coord.x / tileSize,
        y: coord.y / tileSize
      };
    };

    const tilePoint = tile =>
      // Return an x, y tile point for a given projected coordinate
      coordinatePoint({x: tile.x * tileSize, y: tile.y * tileSize})
    ;

    const floor = tile =>
      ({
        x: Math.floor(tile.x),
        y: Math.floor(tile.y)
      })
    ;

    const lnglatPoint = function(lnglat) {
      [lng, lat] = Array.from(lnglat);
      const {x, y} = coordinatePoint(proj.project({x:lng, y:lat}, zoom));
      return [x, y];
    };

    const getTile = function(tile) {
      // Cycle through tile providers to spread load
      const url = providers[providerIndex](tile, zoom);
      providerIndex = (providerIndex+1) % providers.length;
      return new Promise(function(resolve, reject) {
        return getImg(url).then(function(img) {
          const {x, y} = tilePoint(tile);
          ctx.drawImage(img, x, y, tileSize, tileSize);
          return resolve();
        }
        , function(err) {
          console.err(err);
          return resolve();
        });
      });
    };

    const startCoord = floor(pointTile({x:0, y:0}));
    const endCoord = floor(pointTile({x:width, y:height}));

    return Promise.all([].concat.apply([], (
      __range__(startCoord.x, endCoord.x, true).map((column) =>
        __range__(startCoord.y, endCoord.y, true).map((row) => getTile({x:column, y:row}))))
    )).then(function() {
      const doCallback = function() {
        let stream;
        if (canvas.pngStream != null) {
          stream = (() => { switch (format) {
            case 'png': return canvas.pngStream();
            case 'jpeg': case 'jpg': return canvas.jpegStream();
          } })();
        }
        return {canvas, stream};
      };
      if (geojson != null) {
        return drawGeoJSON({ctx, lnglatPoint, geojson}).then(doCallback);
      } else {
        return doCallback();
      }
    });
  });
};

module.exports = printlet;

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}