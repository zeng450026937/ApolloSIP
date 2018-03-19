const SIP = require('./Base/SIP');
const Utils = require('./Base/Utils');
const UA = require('./UA/UA');
const Call = require('./Call/Call');
const CallManager = require('./Call/CallManager');
const Conference = require('./Conference/Conference');
const ConferenceManager = require('./Conference/ConferenceManager');

const ApolloSIP = {
  SIP               : SIP,
  Utils             : Utils,
  UA                : UA,
  Call              : Call,
  CallManager       : CallManager,
  Conference        : Conference,
  ConferenceManager : ConferenceManager,
  debug             : SIP.debug
};

module.exports = ApolloSIP;