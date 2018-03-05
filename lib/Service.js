const EventEmitter = require('events').EventEmitter;
const SIP_C = require('./Constants');
const SIPMessage = require('./SIPMessage');
const Utils = require('./Utils');
const RequestSender = require('./RequestSender');
const Exceptions = require('./Exceptions');
const debug = require('debug')('SIP:Service');

module.exports = class Service extends EventEmitter
{
  constructor(ua)
  {
    super();

    this._ua = ua;
    this._request = null;
    this._closed = false;

    this._direction = null;
    this._local_identity = null;
    this._remote_identity = null;

    // Whether an incoming message has been replied.
    this._is_replied = false;
  }

  get direction()
  {
    return this._direction;
  }

  get local_identity()
  {
    return this._local_identity;
  }

  get remote_identity()
  {
    return this._remote_identity;
  }

  send(target, event, body, options = {})
  {
    const originalTarget = target;

    if (target === undefined || event === undefined || body === undefined)
    {
      throw new TypeError('Not enough arguments');
    }

    // Check target validity.
    target = this._ua.normalizeTarget(target);
    if (!target)
    {
      throw new TypeError(`Invalid target: ${originalTarget}`);
    }

    // Get call options.
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const eventHandlers = options.eventHandlers || {};
    const contentType = options.contentType || 'text/plain';
    const params = { cseq: 1 };

    // Set event handlers.
    for (const handler in eventHandlers)
    {
      if (Object.prototype.hasOwnProperty.call(eventHandlers, handler))
      {
        this.on(handler, eventHandlers[handler]);
      }
    }

    extraHeaders.push(`Event: ${event}`);
    extraHeaders.push(`Content-Type: ${contentType}`);

    this._request = new SIPMessage.OutgoingRequest(
      SIP_C.SERVICE, target, this._ua, params, extraHeaders);

    if (body)
    {
      this._request.body = body;
    }

    const request_sender = new RequestSender(this._ua, this._request, {
      onRequestTimeout : () =>
      {
        this._onRequestTimeout();
      },
      onTransportError : () =>
      {
        this._onTransportError();
      },
      onReceiveResponse : (response) =>
      {
        this._receiveResponse(response);
      }
    });

    this._newService('local', this._request);

    request_sender.send();
  }

  init_incoming(request)
  {
    this._request = request;

    this._newService('remote', request);

    // Reply with a 200 OK if the user didn't reply.
    if (!this._is_replied)
    {
      this._is_replied = true;
      request.reply(200);
    }

    this._close();
  }

  /**
   * Accept the incoming Service
   * Only valid for incoming Service
   */
  accept(options = {})
  {
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const body = options.body;

    if (this._direction !== 'incoming')
    {
      throw new Exceptions.NotSupportedError('"accept" not supported for outgoing Service');
    }

    if (this._is_replied)
    {
      throw new Error('incoming Service already replied');
    }

    this._is_replied = true;
    this._request.reply(200, null, extraHeaders, body);
  }

  /**
   * Reject the incoming Service
   * Only valid for incoming Service
   */
  reject(options = {})
  {
    const status_code = options.status_code || 480;
    const reason_phrase = options.reason_phrase;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const body = options.body;

    if (this._direction !== 'incoming')
    {
      throw new Exceptions.NotSupportedError('"reject" not supported for outgoing Service');
    }

    if (this._is_replied)
    {
      throw new Error('incoming Service already replied');
    }

    if (status_code < 300 || status_code >= 700)
    {
      throw new TypeError(`Invalid status_code: ${status_code}`);
    }

    this._is_replied = true;
    this._request.reply(status_code, reason_phrase, extraHeaders, body);
  }


  _receiveResponse(response)
  {
    if (this._closed)
    {
      return;
    }
    switch (true)
    {
      case /^1[0-9]{2}$/.test(response.status_code):
        // Ignore provisional responses.
        break;

      case /^2[0-9]{2}$/.test(response.status_code):
        this._succeeded('remote', response);
        break;

      default:
      {
        const cause = Utils.sipErrorCause(response.status_code);

        this._failed('remote', response, cause);
        break;
      }
    }
  }

  _onRequestTimeout()
  {
    if (this._closed)
    {
      return;
    }
    this._failed('system', null, SIP_C.causes.REQUEST_TIMEOUT);
  }

  _onTransportError()
  {
    if (this._closed)
    {
      return;
    }
    this._failed('system', null, SIP_C.causes.CONNECTION_ERROR);
  }

  _close()
  {
    this._closed = true;
    this._ua.destroyService(this);
  }

  /**
   * Internal Callbacks
   */

  _newService(originator, request)
  {
    if (originator === 'remote')
    {
      this._direction = 'incoming';
      this._local_identity = request.to;
      this._remote_identity = request.from;
    }
    else if (originator === 'local')
    {
      this._direction = 'outgoing';
      this._local_identity = request.from;
      this._remote_identity = request.to;
    }

    this._ua.newService(this, {
      originator,
      service : this,
      request
    });
  }

  _failed(originator, response, cause)
  {
    debug('SERVICE failed');

    this._close();

    debug('emit "failed"');

    this.emit('failed', {
      originator,
      response : response || null,
      cause
    });
  }

  _succeeded(originator, response)
  {
    debug('SERVICE succeeded');

    this._close();

    debug('emit "succeeded"');

    this.emit('succeeded', {
      originator,
      response
    });
  }
};
