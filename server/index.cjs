'use strict';

const register = require('react-server-dom-webpack/node-register');
register();
const babelRegister = require('@babel/register');

babelRegister({
    ignore: [/[\\\/](build|server|node_modules)[\\\/]/],
    presets: [['@babel/preset-react', {runtime: 'automatic'}]],
    plugins: ['@babel/transform-modules-commonjs'],
});

const express = require('express');
const {readFileSync} = require('fs');
const {renderToPipeableStream} = require('react-server-dom-webpack/server');
const path = require('path');
const React = require('react');
const myEmitter = require("./customHeaderCallback");
const ReactApp = require('../src/App').default;
const {Transform, Writable} = require('node:stream');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(express.json());

app.listen(PORT, () => {
    console.log(`React Notes listening at ${PORT}...`);
});

function handleErrors(fn) {
    return async function (req, res, next) {
        try {
            return await fn(req, res);
        } catch (x) {
            next(x);
        }
    };
}

app.get(
    '/',
    handleErrors(async function (_req, res) {
        await waitForWebpack();
        const html = readFileSync(
            path.resolve(__dirname, '../build/index.html'),
            'utf8'
        );

        res.send(html);
    })
);

class ResponseTransformStream extends Transform {
    constructor(opt) {
        super(opt);

        this._max = 1000;
        this._index = 0;

        // this.listener = () => {
        //     console.log(`Listener activated`);
        //     return opt.response;
        // };
        // myEmitter.addListener("headerUpdater", this.listener);
    }

    _read() {
        this._index += 1;

        if (this._index > this._max) {
            this.push(null);
        } else {
            const buf = Buffer.from(`${this._index}`, 'utf8');

            this.push(buf);
        }
    }

    // on = () => {
    //     myEmitter.on('drain', this.listener);
    // }

    _write(chunk, encoding, callback) {
        console.log(chunk.toString());
        console.log(callback)
        try {
            callback(null, chunk);
        } catch (err) {
            callback(err);
        }
        // callback();
    }

    // destroy(error) {
    //     console.log(error);
    // }

    end() {
        console.log('end');
        return this;
    }

    // pipe(destination) {
    //     console.log(destination);
    //     return renderToPipeableStream(destination);
    // }

    // _transform(chunk, encoding, callback) {
    //     try {
    //         const resultString = `*${chunk.toString('utf8')}*`;
    //
    //         callback(null, resultString);
    //     } catch (err) {
    //         callback(err);
    //     }
    // }
}

class ResponseWriteable extends Writable {

}

async function renderReactTree(res, props) {
    await waitForWebpack();
    console.log("rendering react tree")
    const manifest = readFileSync(
        path.resolve(__dirname, '../build/react-client-manifest.json'),
        'utf8'
    );
    const moduleMap = JSON.parse(manifest);

    // const listener = (res) => {
    //     console.log(`Listener activated`);
    //     return res;
    // };
    //
    // myEmitter.addListener("headerUpdater", listener);

    const stream = renderToPipeableStream(
        React.createElement(ReactApp, {page: props}), moduleMap);
    // it will be easy to make not mock object and make transform stream on response with accumulator

    const responseTransform = new ResponseTransformStream({response: res});
    // const responseTransform = new ResponseWriteable();
    stream.pipe(responseTransform).pipe(res);
    console.log("react tree rendered")
}

function sendResponse(req, res, redirectToId) {
    let location = JSON.parse(req.query.page);
    if (redirectToId) {
        location = redirectToId;
    }
    res.set('X-Location', location);
    renderReactTree(res, location);
}

app.get('/rsc', function (req, res) {
    sendResponse(req, res, null);
});

app.use(express.static('build'));
app.use(express.static('public'));

async function waitForWebpack() {
    while (true) {
        try {
            readFileSync(path.resolve(__dirname, '../build/index.html'));
            return;
        } catch (err) {
            console.log(
                'Could not find webpack build output. Will retry in a second...'
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
