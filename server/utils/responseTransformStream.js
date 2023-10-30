const {Transform} = require('node:stream');

class ResponseTransformStream extends Transform {
  constructor() {
    super();
  }

  _transform(chunk, encoding, callback) {
    try {
      let resultString = `${chunk.toString('utf8')}`;
      console.log('Response transform stream get this chunk: ', chunk);
      console.log('Encoded chunk: ', resultString);

      resultString = resultString.replace(
        'Loading...',
        'Loaaaaading)))) We win a game, but lose a war'
      );

      callback(null, resultString);
    } catch (err) {
      callback(err);
    }
  }
}

const responseTransformStream = new ResponseTransformStream();

module.exports = responseTransformStream;
