const SIP = require('../lib/SIP');
const Utils = require('./Utils');
const UA = require('./UA');
const Call = require('./Call');
const Phone = require('./Phone');

const Apollo = {
  SIP   : SIP,
  Utils : Utils,
  UA    : UA,
  Call  : Call,
  Phone : Phone,
  debug : SIP.debug
};

module.exports = Apollo;