const each = require('lodash/forEach');

class Drawer {
  constructor(opts) {
    this.options = opts;
    this.ctx = opts.ctx;
    this.ctx.fillStyle = this.options.fillStyle || 'rgba(0, 51, 255, 0.5)';
    this.ctx.strokeStyle = this.options.strokeStyle || 'rgb(0, 51, 255)';
  }

  addFeature(points, type) {
    switch (type) {
      case "LineString":
        this.drawPath(points);
        break;
      case "Polygon":
        this.drawPolygon(points);
        break;
    }
  }

  drawPath(points) {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);

    each(points, (point, i) => {
      console.log('Drawing point', point.x, point.y);
      this.ctx.lineTo(point.x, point.y);
    });

    this.ctx.stroke();
  }

  drawPolygon(points) {
    this.ctx.beginPath();

    each(points, (point, i) => {
      this.ctx.lineTo(point.x, point.y);
    });

    this.ctx.stroke();
    this.ctx.fill();
  }
}

module.exports = Drawer;
