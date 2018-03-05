const EventEmitter = require('events').EventEmitter;
const debugerror = require('debug')('SIP:ERROR:RTCSession:Info');

debugerror.log = console.warn.bind(console);
const SIP_C = require('../Constants');
const Exceptions = require('../Exceptions');
const Utils = require('../Utils');

module.exports = class Info extends EventEmitter
{
  constructor(session)
  {
    super();

    this._session = session;
    this._direction = null;
    this._contentType = null;
    this._body = null;
  }

  get contentType()
  {
    return this._contentType;
  }

  get body()
  {
    return this._body;
  }

  send(contentType, body, options = {})
  {
    this._direction = 'outgoing';

    if (contentType === undefined)
    {
      throw new TypeError('Not enough arguments');
    }

    // Check RTCSession Status.
    if (this._session.status !== this._session.C.STATUS_CONFIRMED &&
      this._session.status !== this._session.C.STATUS_WAITING_FOR_ACK)
    {
      throw new Exceptions.InvalidStateError(this._session.status);
    }

    this._contentType = contentType;
    this._body = body;

    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const eventHandlers = options.eventHandlers || {};

    // Set event handlers.
    for (const event in eventHandlers)
    {
      if (Object.prototype.hasOwnProperty.call(eventHandlers, event))
      {
        this.on(event, eventHandlers[event]);
      }
    }

    extraHeaders.push(`Content-Type: ${contentType}`);

    this._session.newInfo({
      originator : 'local',
      info       : this,
      request    : this.request
    });

    this._session.sendRequest(SIP_C.INFO, {
      extraHeaders,
      eventHandlers : {
        onSuccessResponse : (response) =>
        {
          this.emit('succeeded', {
            originator : 'remote',
            response
          });
        },
        onErrorResponse : (response) =>
        {
          this.emit('failed', {
            originator : 'remote',
            response
          });
        },
        onTransportError : () =>
        {
          this._session.onTransportError();
        },
        onRequestTimeout : () =>
        {
          this._session.onRequestTimeout();
        },
        onDialogError : () =>
        {
          this._session.onDialogError();
        }
      },
      body
    });
  }

  init_incoming(request)
  {
    this._direction = 'incoming';
    this.request = request;

    request.reply(200);

    this._contentType = request.getHeader('content-type');
    this._body = request.body;

    this._session.newInfo({
      originator : 'remote',
      info       : this,
      request
    });
  }
};
