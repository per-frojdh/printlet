const { projection } = require('./proj');
const Canvas = require('canvas');
const { get } = require('axios');
const polygon = require('./geojson.json');
const Drawer = require('./draw');
const each = require('lodash/forEach');
const bbox = require('@turf/bbox');
const center = require('@turf/center');

const providerOptions = {
  "tiles": "http://tile.openstreetmap.org/{Z}/{X}/{Y}.png",
  "minzoom": 0,
  "maxzoom": 18,
};

const defaultOptions = {
  width: 800,
  height: 600,
  zoom: 14,
  lng: 11.95,
  lat: 57.7,
  format: 'png',
  geojson: polygon,
};

class PrinterMap {
  constructor(opts) {
    this.tileSize = 256;
    this.options = {...defaultOptions, ...opts};
    this.proj = projection(this.options);
    this.canvas = new Canvas(this.options.width, this.options.height);
    this.ctx = this.canvas.getContext('2d');

    this.location = { x: this.options.lng, y: this.options.lat };
    this.center = this.proj.project(this.location, this.options.zoom);
    this.startCoord = this.floor(this.pointTile({ x: 0, y: 0 }));
    this.endCoord = this.floor(this.pointTile({ x: this.options.width, y: this.options.height}));
  }

  create() {
    return new Promise(async (resolve, reject) => {
      const drawer = new Drawer({
        ctx: this.ctx,
        width: this.options.width,
        height: this.options.height,
        center: this.center
      })

      const list = await this.drawOnCanvas();
      await Promise.all(list);

      if (this.options.geojson != null) {
        const features = this.processGeoJSON(this.options.geojson);
        each(features, (feature) => {
          drawer.addFeature(feature.points, feature.type)
        })
      }

      let stream;
      if (this.canvas.pngStream != null) {
        stream = (() => { switch (this.options.format) {
          case 'png' : return this.canvas.pngStream();
          case 'jpeg':
          case 'jpg': return this.canvas.jpegStream();
        }})();

        resolve({
          canvas: this.canvas,
          stream
        })
      }
    })
  }

  pointCoordinate(point) {
    return {
      x: this.center.x + (point.x - (this.options.width/2)),
      y: this.center.y + (point.y - (this.options.height/2)),
    }
  }

  // Return an x, y point on the map image for a given coordinate
  coordinatePoint(coord) {
    return {
      x: ((this.options.width/2) + (coord.x)) - this.center.x,
      y: ((this.options.height/2) + (coord.y)) - this.center.y,
    }
  };

  // Return tile coordinate reflecting pixel points from map center
  pointTile(point) {
    const coord = this.pointCoordinate(point);
    console.log(coord)
    return {
      x: coord.x / this.tileSize,
      y: coord.y / this.tileSize,
    }
  }

  // Return an x, y tile point for a given projected coordinate
  tilePoint(tile) {
    const coord = {
      x: tile.x * this.tileSize,
      y: tile.y * this.tileSize,
    };
    return this.coordinatePoint(coord);
  }

  floor(tile) {
    return {
      x: Math.floor(tile.x),
      y: Math.floor(tile.y),
    }
  };


  lngLatPoint(lngLat) {
    const [lng, lat] = Array.from(lngLat);
    const { x, y } = this.coordinatePoint(this.proj.project({
      x: lng,
      y: lat
    }, this.options.zoom));
    return [x, y]
  };

  tileUrl(tmpl, tile) {
    return tmpl
        .replace(/{Z}/i, this.options.zoom.toFixed(0))
        .replace(/{X}/i, tile.x.toFixed(0))
        .replace(/{Y}/i, tile.y.toFixed(0));
  }

  createImage(url) {
    return new Promise(async (resolve, reject) => {
      console.log('Getting image at url: ', url);
      const res = await get(url, {
        responseType: 'arraybuffer'
      });

      const data = new Buffer(res.data, 'binary');
      const img = new Canvas.Image;
      img.src = data;
      return resolve(img);
    });
  }

  setRange(left, right, inclusive) {
    let range = [];
    let ascending = left < right;
    let end = !inclusive ? right: ascending ? right + 1: right - 1;
    for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
      range.push(i);
    }
    return range;
  }

  getTile(tile) {
    const url = this.tileUrl(providerOptions.tiles, tile);
    return new Promise(async (resolve, reject) => {
      const image = await this.createImage(url);
      const { x, y } = this.tilePoint(tile);
      this.ctx.drawImage(image, x, y, this.tileSize, this.tileSize);
      return resolve();
    });
  }

  drawOnCanvas() {
    const promises = [];
    return new Promise((resolve, reject) => {
      this.setRange(this.startCoord.x, this.endCoord.x, true).map((column) => {
        this.setRange(this.startCoord.y, this.endCoord.y, true).map((row) => {
          promises.push(this.getTile({ x: column, y: row }));
        })
      });

      resolve(promises)
    });
  };

  processGeoJSON(geojson) {
    const features = [];
    each(geojson.features, (feature) => {
      const points = [];
      let coordinates;
      switch (feature.geometry.type) {
        case "Polygon":
          coordinates = feature.geometry.coordinates[0];
          break;
        default:
          coordinates = feature.geometry.coordinates;
      }

      each(coordinates, (xy) => {
        let lngLat = this.lngLatPoint(xy);
        points.push({
          x: lngLat[0],
          y: lngLat[1]
        });
      })

      features.push({
        points,
        type: feature.geometry.type
      });

    })

    return features;
  };
}

module.exports = {
  PrinterMap
}
