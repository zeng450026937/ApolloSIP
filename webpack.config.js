const webpack = require('webpack');
const pkg = require('./package.json');
const year = new Date().getFullYear();
const banner = `Apollo version ${pkg.version}\n
Copyright (c) 2018-${year} Yealink Networks, Inc\n`;

module.exports = {
  entry : {
    'apollosip' : `${__dirname}/src/ApolloSIP.js`
  },
  output : {
    path          : `${__dirname}/dist`,
    filename      : '[name].js',
    library       : 'ApolloSIP',
    libraryTarget : 'umd'
  },
  mode   : 'production',
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
