const EventEmitter = require('events').EventEmitter;
const MediaChannel = require('../Channel/MediaChannel');
const Utils = require('../Base/Utils');
const SIP = require('../Base/SIP');

const debug = SIP.debug('Apollo:Call');

module.exports = class Call extends EventEmitter
{
  constructor() 
  {
    super();

    this._ua = undefined;
    this._session = undefined;
    this._target = undefined;

    this._mediaChannel = new MediaChannel();

    const eventHandlers = {
      uaChanged : () =>
      {
        this.mediaChannel.ua = this.ua;
      },
      sessionChanged : () =>
      {
        this.mediaChannel.session = this.session;
      },
      targetChanged : () =>
      {
        this.mediaChannel.target = this.target;
      }
    };

    Utils.setupEventHandlers(this, eventHandlers);
  }
  
  get ua()
  {
    return this._ua;
  }
  set ua(ua)
  {
    if (this._ua !== ua)
    {
      this._ua = ua;
      this.emit('uaChanged', ua);
    }
  }

  get session()
  {
    return this._session;
  }
  set session(session)
  {
    if (this._session !== session)
    {
      this._session = session;
      this.emit('sessionChanged', session);
    }
  }

  get target()
  {
    return this._target;
  }
  set target(target)
  {
    if (this._target !== target)
    {
      this._target = target;
      this.emit('targetChanged', target);
    }
  }

  get mediaChannel()
  {
    return this._mediaChannel;
  }
  get media()
  {
    return this._mediaChannel.media;
  }

  isAvariable()
  {
    return this.ua && this.ua.isRegistered() && this.ua.get('iceServers');
  }
  
  connect()
  {
    this.mediaChannel.connect();
  }
};