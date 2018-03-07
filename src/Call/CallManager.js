const Manager = require('../Manager/Manager');
const Media = require('../Channel/Media');
const Call = require('./Call');

module.exports = class CallManager extends Manager
{
  constructor() 
  {
    super();

    this._media = new Media();
    this._call = undefined;
  }

  get media()
  {
    return this._media;
  }

  outgoing(target)
  {
    const call = new Call();

    call.ua = this.ua;
    call.target = target;
    call.media = this.media;
    
    return call;
  }

  incoming(session)
  {
    const call = new Call();

    call.ua = this.ua;
    call.session = session;
    call.media = this.media;

    return call;
  }

  refer()
  {

  }

  onNewRTCSession(data)
  {
    // incoming session
    if (data.originator === 'remote')
    {
      this.incoming(data.session);

      this.emit('incoming');
    }
    // outgoing session
    if (data.originator === 'local')
    {
      this.emit('outgoing');
    }
  }

  onNewMessage(data)
  {
    // incoming message
    if (data.originator === 'remote')
    {
      this.emit('incoming');
    }
    // outgoing message
    if (data.originator === 'local')
    {
      this.emit('outgoing');
    }
  }
};