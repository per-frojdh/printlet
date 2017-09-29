const fs = require('fs');
const { PrinterMap } = require('./src');

(async () => {
  try {
    const printer = new PrinterMap();
    const { stream, canvas } = await printer.create();
    stream.pipe(fs.createWriteStream('image.png'));
  } catch (ex) {
    console.error(ex)
  };
})();
