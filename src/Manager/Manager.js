const EventEmitter = require('events').EventEmitter;
const Utils = require('../Base/Utils');

module.exports = class Manager extends EventEmitter
{
  constructor()
  {
    super();

    this._ua = undefined;
  }

  get ua()
  {
    return this._ua;
  }
  set ua(ua)
  {
    if (this._ua !== ua)
    {
      const eventHandlers = {
        connecting                  : this.onConnecting.bind(this),
        connected                   : this.onConnected.bind(this),
        disconnected                : this.onDisconnected.bind(this),
        registered                  : this.onRegistered.bind(this),
        unregistered                : this.onUnregistered.bind(this),
        registrationFailed          : this.onRegistrationFailed.bind(this),
        newRTCSession               : this.onNewRTCSession.bind(this),
        newMessage                  : this.onNewMessage.bind(this),
        conferenceFactoryUriUpdated : this.onConferenceFactoryUriUpdated.bind(this)
      };

      Utils.removeEventHandlers(this._ua, eventHandlers);

      this._ua = ua;

      Utils.setupEventHandlers(this._ua, eventHandlers);

      this.emit('uaChanged', ua);
    }
  }

  isAvariable()
  {
    return this.ua && this.ua.isRegistered();
  }

  onConnecting(data) 
  {
    this.emit('connecting', data);
  }

  onConnected(data) 
  {
    this.emit('connected', data);
  }

  onDisconnected(data) 
  {
    this.emit('disconnected', data);
  }

  onRegistered(data) 
  {
    this.emit('registered', data);
  }

  onUnregistered(data) 
  {
    this.emit('unregistered', data);
  }

  onRegistrationFailed(data) 
  {
    this.emit('registrationFailed', data);
  }

  onNewRTCSession(data)
  {
    this.emit('newRTCSession', data);
  }

  onNewMessage(data)
  {
    this.emit('newMessage', data);
  }

  onConferenceFactoryUriUpdated(uri)
  {
    this.emit('conferenceFactoryUriUpdated', uri);
  }
};