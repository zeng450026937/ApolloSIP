
const ApolloSIP = {
  SIP               : require('../lib/SIP'),
  Utils             : require('./Base/Utils'),
  UA                : require('./UA/UA'),
  Call              : require('./Call/Call'),
  CallManager       : require('./Call/CallManager'),
  Conference        : require('./Conference/Conference'),
  ConferenceManager : require('./Conference/ConferenceManager'),
  debug             : require('debug')
};

module.exports = ApolloSIP;