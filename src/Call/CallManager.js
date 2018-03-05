const Manager = require('../Manager/Manager');
const Call = require('./Call');

module.exports = class CallManager extends Manager
{
  constructor() 
  {
    super();
  }

  outgoing(target, media)
  {
    const call = new Call();

    call.ua = this.ua;
    call.target = target;
    call.media = media;

    return call;
  }

  incoming(session, media)
  {
    const call = new Call();

    call.ua = this.ua;
    call.session = session;
    call.media = media;

    return call;
  }
};