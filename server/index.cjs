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
const ReactApp = require('../src/App').default;

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

async function renderReactTree(res, props) {
    await waitForWebpack();
    console.log("rendering react tree")
    const manifest = readFileSync(
        path.resolve(__dirname, '../build/react-client-manifest.json'),
        'utf8'
    );
    const moduleMap = JSON.parse(manifest);

    const {pipe} = renderToPipeableStream(
        React.createElement(ReactApp, {page: props}), moduleMap,
        {
            onAllReady() {
                console.log('allReady🙂');
                const headers = JSON.parse(readFileSync(
                    path.resolve(__dirname, '../server/needHeaders.json'),
                    'utf8'
                ));
                console.log(headers, '🙂')
                for (const key in headers) {
                    res.setHeader(key, headers[key]);
                }
            },
            onShellReady() {
                console.log('shellReady');
                const headers = JSON.parse(readFileSync(
                    path.resolve(__dirname, '../server/needHeaders.json'),
                    'utf8'
                ));
                for (const key in headers) {
                    res.setHeader(key, headers[key]);
                }
            },
            onShellError(error) {
                console.log(123, error);
            },
            onError(error) {
                console.log(123, error);
            }
        }
    );
    // transformers
    pipe(res);
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
