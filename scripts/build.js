/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

const path = require('path');
const rimraf = require('rimraf');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactServerWebpackPlugin = require('react-server-dom-webpack/plugin');

const isProduction = process.env.NODE_ENV === 'production';
rimraf.sync(path.resolve(__dirname, '../build'));

const defaultEntry = '../src/index.js';
const defaultFilename = 'index.html';

function runWebpack(entry, pageName) {
  webpack(
    {
      mode: isProduction ? 'production' : 'development',
      devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
      entry: [path.resolve(__dirname, entry)],
      output: {
        path: path.resolve(__dirname, '../build'),
        filename: pageName ? pageName + '.js' : 'main.js',
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            use: 'babel-loader',
            exclude: /node_modules/,
          },
        ],
      },
      plugins: [
        new HtmlWebpackPlugin({
          filename: pageName ? pageName + '.html' : 'index.html',
          inject: true,
          template: path.resolve(__dirname, '../public/index.html'),
        }),
        new ReactServerWebpackPlugin({isServer: false}),
      ],
    },
    (err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          console.error(err.details);
        }
        process.exit(1);
      }
      const info = stats.toJson();
      if (stats.hasErrors()) {
        console.log('Finished running webpack with errors.');
        info.errors.forEach((e) => console.error(e));
        process.exit(1);
      } else {
        console.log('Finished running webpack.');
      }
    }
  );
}

runWebpack(defaultEntry);
// runWebpack('../src/build/indexes/Page1.js', 'Page1');
// runWebpack('../src/build/indexes/Page2.js', 'Page2');
// runWebpack('../src/build/indexes/Page3.js', 'Page3');
