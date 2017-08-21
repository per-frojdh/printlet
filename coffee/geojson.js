/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise = require('promise');
const util = require('./util');

const df = function(v, dv) { if (v != null) { return v; } else { return dv; } };

module.exports = function(opt) {
  const {ctx, lnglatPoint, geojson:{features}} = opt;

  const withStyle = function(style, fn) {
    const fill = ((style != null ? style.fillStyle : undefined) != null);
    let stroke = ((style != null ? style.strokeStyle : undefined) != null);
    if (!stroke && !fill) { stroke = true; }
    ctx.save();
    try {
      for (let name in style) { const value = style[name]; ctx[name] = value; }
      return fn(ctx, fill, stroke);
    } finally {
      ctx.restore();
    }
  };

  const drawPath = (style, fn) =>
    withStyle(style, function(ctx, fill, stroke) {
      ctx.beginPath();
      fn(ctx);
      if (fill) { ctx.fill(); }
      if (stroke) { return ctx.stroke(); }
    })
  ;

  const drawFeature = feature =>
    new Promise(function(resolve, reject) {
      let style;
      let image, offset, radius, text;
      const {type, coordinates:lnglats} = feature.geometry;
      if (feature.properties != null) { ({style} = feature.properties); }
      switch (type) {
        case 'Point':
          var [x, y] = Array.from(lnglatPoint(lnglats));

          if ((style != null ? style.marker : undefined) != null) {
            ({image, text, radius, offset} = style.marker);
            if (offset == null) { offset = {fx:0.5, fy:0.5}; }
          }

          if (image != null) {
            util.img(image, function(err, img) {
              if (err != null) {
                console.warn(err);
              } else {
                x -= (img.width * df(offset.fx, 0)) - df(offset.x, 0);
                y -= (img.height * df(offset.fy, 0)) - df(offset.y, 0);
                ctx.drawImage(img, x, y, img.width, img.height);
              }
              return resolve();
            });
            return;
          } else if (text != null) {
            withStyle(style, function(ctx) {
              const {
                width,
                actualBoundingBoxAscent: ascent,
                actualBoundingBoxDescent: descent
              } = ctx.measureText(text);
              x -= (width * df(offset.fx, 0)) - df(offset.x, 0);
              y -= descent - ((ascent + descent) * df(offset.fy, 0)) - df(offset.y, 0);
              return ctx.fillText(text, x, y);
            });
          } else {
            drawPath(style, ctx => ctx.arc(x, y, df(radius, 8), 0 , 2 * Math.PI, false));
          }
          break;
        case 'LineString':
          drawPath(style, ctx => Array.from(lnglats).map((lnglat) => ctx.lineTo.apply(ctx, lnglatPoint(lnglat))));
          break;
        case 'Polygon':
          drawPath(style, ctx =>
            (() => {
              const result = [];
              for (let ring of Array.from(lnglats)) {
                for (let lnglat of Array.from(ring)) {
                  ctx.lineTo.apply(ctx, lnglatPoint(lnglat));
                }
                result.push(ctx.closePath());
              }
              return result;
            })()
          );
          break;
        case 'MultiPolygon':
          drawPath(style, ctx =>
            Array.from(lnglats).map((polys) =>
              (() => {
                const result = [];
                for (let ring of Array.from(polys)) {
                  for (let lnglat of Array.from(ring)) {
                    ctx.lineTo.apply(ctx, lnglatPoint(lnglat));
                  }
                  result.push(ctx.closePath());
                }
                return result;
              })())
          );
          break;
      }
      return resolve();
    })
  ;

  return features.reduce(((p, f) => p.then(drawFeature.bind(null, f))),
    new Promise(function(r) { return r(); }));
};
