/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
if (typeof window !== 'undefined') {
  exports.canvas = function(width, height) {
    const canvas = window.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  exports.img = function(url, callback) {
    const img = new Image;
    img.onload = () => callback(undefined, img);
    return img.src = url;
  };
} else {
  // Stop Browserify from including non-browser libs
  const nonbrowser = {};
  for (let k of ['get', 'canvas']) { nonbrowser[k] = require(k); }

  exports.canvas = (width, height) => new nonbrowser.canvas(width, height);

  exports.img = (url, callback) =>
    new nonbrowser.get(url).asBuffer(function(err, data) {
      if (err) { return callback(err); }
      const img = new nonbrowser.canvas.Image;
      img.src = data;
      return callback(undefined, img);
    })
  ;
}
