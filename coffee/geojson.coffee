get = require 'get'
Canvas = require 'canvas'

module.exports = (opt, callback) ->
  {ctx, lnglatPoint, geojson:{features}} = opt

  numRequests = 0
  completeRequests = 0
  processedFeatures = 0

  checkDone = ->
    if numRequests is completeRequests and processedFeatures is features.length
      callback()

  drawPath = (style, fn) ->
    fill = style.fillStyle?
    stroke = style.strokeStyle?
    if fill and stroke
      ctx.save()
      try
        (ctx[name] = value) for name, value of style
        ctx.beginPath()
        fn()
        ctx.fill() if fill
        ctx.stroke() if stroke
      finally
        ctx.restore()

  drawFeature = (feature) ->
    {type, coordinates:lnglats} = feature.geometry
    {style} = feature.properties
    switch type
      when 'Point'
        [x, y] = lnglatPoint lnglats
        if style?.image?
          {url, offset} = style.image
          numRequests++
          new get(url).asBuffer (err, data) ->
            (return console.warn err) if err?
            img = new Canvas.Image
            img.src = data
            offset ?= x:img.width/2, y:img.height/2
            x -= offset.x
            y -= offset.y
            ctx.drawImage img, x, y, img.width, img.height
            completeRequests++
            checkDone()
        else
          drawPath style, ->
            ctx.arc x, y, (style?.radius or 8), 0 , 2 * Math.PI, false
      when 'LineString', 'Polygon'
        drawPath style, ->
          ctx.lineTo.apply(ctx, lnglatPoint lnglat) for lnglat in lnglats
          ctx.lineTo.apply(ctx, lnglatPoint lnglats[0]) if type is 'Polygon'

  for feature in features
    drawFeature feature
    processedFeatures++
  checkDone()
  return