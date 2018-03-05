const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const webpack = require('webpack');

const pkg = require('./package.json');
const year = new Date().getFullYear();
const banner = `Apollo version ${pkg.version}\n
Copyright (c) 2018-${year} Yealink Networks, Inc\n\n`;

module.exports = {
  entry : {
    'apollosip'     : `${__dirname }/src/ApolloSip.js`,
    'apollosip.min' : `${__dirname }/src/ApolloSip.js`
  },
  output : {
    path          : `${__dirname }/dist`,
    filename      : '[name].js',
    library       : 'ApolloSip',
    libraryTarget : 'umd'
  },
  module : {
    rules : [
      {
        test    : /\.js$/,
        exclude : /node_modules/,
        loader  : 'babel-loader',
        options : {
          presets : [ 'env' ]
        }
      },
      {
        test    : /\.pegjs$/,
        loader  : 'pegjs-loader',
        options : {
          'optimize' : 'size'
        }
      }
    ]
  },
  plugins : [
    new UglifyJSPlugin({
      test          : /^apollo\.min\.js$/,
      uglifyOptions : {
        output : {
          ascii_only : true
        }
      }
    }),
    new webpack.BannerPlugin({
      banner : banner
    })
  ]
};
