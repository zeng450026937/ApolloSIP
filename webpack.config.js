const webpack = require('webpack');

const path = require('path');
const pkg = require('./package.json');
const year = new Date().getFullYear();
const banner = `Apollo version ${pkg.version}\n
Copyright (c) 2018-${year} Yealink Networks, Inc\n`;

const baseConfig = {
  output : {
    path          : `${__dirname }/dist`,
    filename      : '[name].js',
    library       : 'ApolloSIP',
    libraryTarget : 'umd'
  },
  mode   : 'development',
  module : {
    rules : [
      {
        test    : /\.js$/,
        exclude : /node_modules(?!(\/|\\)fast-xml-parser)/,
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
    new webpack.BannerPlugin({
      banner : banner
    })
  ]
};
const webConfig = Object.assign({}, baseConfig, { 
  target : 'web',
  entry  : {
    'apollosip-web' : `${__dirname }/src/ApolloSIP.js`
  }
});

const electronConfig = Object.assign({}, baseConfig, { 
  target : 'electron-renderer',
  entry  : {
    'apollosip' : `${__dirname }/src/ApolloSIP.js`
  }
});

module.exports = [ electronConfig, webConfig ];
