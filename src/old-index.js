const { projection } = require('./proj');
const Canvas = require('canvas');
const { get } = require('axios');
const polygon = require('./geojson.json');
const Drawer = require('./draw');
const each = require('lodash/forEach');

const providerOptions = {
  "tiles": "http://tile.openstreetmap.org/{Z}/{X}/{Y}.png",
  "minzoom": 0,
  "maxzoom": 18,
};

const defaultOptions = {
  width: 800,
  height: 600,
  zoom: 13,
  lng: 11.95,
  lat: 57.7,
  format: 'png',
  geojson: polygon
};

const makeMap = opts => {
  const tileSize = 256;
  const options = {...defaultOptions, ...opts};

  // Should merge opts with defaultOptions;
  const {
    width,
    height,
    zoom,
    lng,
    lat,
    geojson,
    format
  } = options;

  const proj = projection(options);
  const location = { x: lng, y: lat };
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext('2d');
  const cc = proj.project(location, zoom);

  // Return projected map coordinate reflecting pixel points from map center
  const pointCoordinate = point => ({
    x: cc.x + (point.x - (width/2)),
    y: cc.y + (point.y - (height/2)),
  });

  // Return an x, y point on the map image for a given coordinate
  const coordinatePoint = coord => ({
    x: ((width/2) + (coord.x)) - cc.x,
    y: ((height/2) + (coord.y)) - cc.y,
  });

  // Return tile coordinate reflecting pixel points from map center
  const pointTile = point => {
    const coord = pointCoordinate(point);
    return {
      x: coord.x / tileSize,
      y: coord.y / tileSize,
    }
  }

  // Return an x, y tile point for a given projected coordinate
  const tilePoint = tile => {
    const coord = {
      x: tile.x * tileSize,
      y: tile.y * tileSize,
    };
    return coordinatePoint(coord);
  }

  const floor = tile => ({
    x: Math.floor(tile.x),
    y: Math.floor(tile.y),
  });


  const lngLatPoint = lngLat => {
    const [lng, lat] = Array.from(lngLat);
    const { x, y } = coordinatePoint(proj.project({
      x: lng,
      y: lat
    }, zoom));
    return [x, y]
  };

  const tileUrl = (tmpl, tile) => {
    return tmpl
        .replace(/{Z}/i, zoom.toFixed(0))
        .replace(/{X}/i, tile.x.toFixed(0))
        .replace(/{Y}/i, tile.y.toFixed(0));
  }

  const createImage = url => {
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

  const setRange = (left, right, inclusive) => {
    let range = [];
    let ascending = left < right;
    let end = !inclusive ? right: ascending ? right + 1: right - 1;
    for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
      range.push(i);
    }
    return range;
  }

  const getTile = tile => {
    const url = tileUrl(providerOptions.tiles, tile);
    return new Promise(async (resolve, reject) => {
      const image = await createImage(url);
      const { x, y } = tilePoint(tile);
      ctx.drawImage(image, x, y, tileSize, tileSize);
      return resolve();
    });
  }

  const drawOnCanvas = () => {
    const promises = [];

    return new Promise((resolve, reject) => {
      setRange(startCoord.x, endCoord.x, true).map((column) => {
        setRange(startCoord.y, endCoord.y, true).map((row) => {
          promises.push(getTile({ x: column, y: row }));
        })
      });

      resolve(promises)
    });
  };

  const processGeoJSON = (geojson) => {
    console.log('Adding geojson', geojson);
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
        let lngLat = lngLatPoint(xy);
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

  const startCoord = floor(pointTile({ x: 0, y: 0 }));
  const endCoord = floor(pointTile({ x: width, y: height }));


  return new Promise(async (resolve, reject) => {
    const draw = new Drawer({
      ctx,
      width,
      height,
      center: cc
    });
    const list = await drawOnCanvas();
    await Promise.all(list);
    if (geojson != null) {
      const features = processGeoJSON(geojson);
      each(features, (feature) => {
        draw.addFeature(feature.points, feature.type);
      });

    }
    let stream;
    if (canvas.pngStream != null) {
      stream = (() => { switch (format) {
        case 'png': return canvas.pngStream();
        case 'jpeg':
        case 'jpg': return canvas.jpegStream();
      }})();

      resolve({ canvas, stream });
    }
  });
}


module.exports = {
  makeMap
}
