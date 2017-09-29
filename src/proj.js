/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const proj4 = require('proj4');

const projection = function(projection, transform, scale) {
  let scales;
  if (typeof projection !== 'string') {
    ({projection, transform, scale, scales} = projection);
  }
  // Set default values if needed
  if (projection == null) { projection = `+proj=merc +a=1 +b=1 +lat_ts=0.0 +lon_0=0.0 \
+x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs`; }
  if (transform == null) { transform = [0.5/Math.PI, 0.5, -0.5/Math.PI, 0.5]; }
  if (transform instanceof Array) {
    transform = transformation.apply(undefined, transform);
  }
  if (scale == null) { scale = (scales != null) ? (z => scales[z]) : (z => Math.pow(2,z+8)); }

  return {
    project(point, zoom) {
      point = proj4(projection, point);
      point = transform.transform(point);
      return this.scale(point, zoom);
    },

    unproject(point, zoom) {
      point = this.scale(point, undefined, zoom);
      point = transform.untransform(point);
      return proj4(projection, proj4.WGS84, point);
    },

    scale(point, to, from) {
      let p;
      if (from != null) {
        p = scale(from);
        point = {x:point.x / p, y:point.y / p};
      }
      if (to != null) {
        p = scale(to);
        point = {x:point.x * p, y:point.y * p};
      }
      return point;
    }
  };
};

var transformation = (a, b, c, d) =>
  ({
    transform(p) {
      return {
        x: (a * p.x) + b,
        y: (c * p.y) + d
      };
    },

    untransform(p) {
      return {
        x: p.x - (b / a),
        y: p.y - (d / c)
      };
    }
  })
;

const tileUrl = tmpl =>
  (tile, zoom) =>
    tmpl
    .replace(/{Z}/i, zoom.toFixed(0))
    .replace(/{X}/i, tile.x.toFixed(0))
    .replace(/{Y}/i, tile.y.toFixed(0))
  
;

module.exports = {projection, transformation, tileUrl};
