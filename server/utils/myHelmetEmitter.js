const EventEmitter = require('node:events');
const fs = require('fs');

class MyHelmetEmitter extends EventEmitter {
  constructor() {
    super();
    this.titles = [];
  }
}

const myHelmetEmitter = new MyHelmetEmitter();

myHelmetEmitter.addListener('updateTitle', (title) => {
  myHelmetEmitter.titles.push(title);
  console.log('myHelmetEmitter titles', myHelmetEmitter.titles);
});

myHelmetEmitter.addListener('updateTitleWebpack', (title) => {
  const helmetData = JSON.parse(
    fs.readFileSync('server/myBuildFiles/myHelmet.json', 'utf-8')
  );
  helmetData['title'] = title;
  fs.writeFileSync(
    'server/myBuildFiles/myHelmet.json',
    JSON.stringify(helmetData)
  );
  console.log('I have written new title to server/myBuildFiles/myHelmet.json');
});

module.exports = myHelmetEmitter;
