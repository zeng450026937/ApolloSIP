const EventEmitter = require('events').EventEmitter;
const SIP_C = require('./Constants');
const SIPMessage = require('./SIPMessage');
const Dialog = require('./Dialog');
const Utils = require('./Utils');
const RequestSender = require('./RequestSender');
const Timers = require('./Timers');
const debug = require('debug')('SIP:Subscription');

const C = {
  // RTCSession states.
  STATUS_NULL               : 0,
  STATUS_SUBSCRIBE_SENT     : 1,
  STATUS_1XX_RECEIVED       : 2,
  STATUS_WAITING_FOR_NOTIFY : 3,
  STATUS_PENDING            : 4,
  STATUS_TERMINATED         : 5,
  STATUS_ACTIVE             : 6
};

module.exports = class Subscription extends EventEmitter
{
  constructor(ua)
  {
    super();
    this._ua = ua;
    this._id = null;
    this._status = C.STATUS_NULL;
    this._from_tag = null;
    this._to_tag = null;
    this._expires = SIP_C.SUBSCRIPTION_EXPIRES;
    this._contact = this._ua.contact.toString();
    this._earlyDialogs = {};
    this._dialog = null;
    this._request = null;
    this._timers = { N: null, sub_duration: null };

    this._target = null;
    this._event = null;
    this._options = null;
    this._contentType = null;
  }

  get id()
  {
    return this._id;
  }

  get isActive()
  {
    return this._status === C.STATUS_ACTIVE;
  }

  subscribe(target, event, options = {})
  {
    if (this._status === C.STATUS_ACTIVE)
    {
      this._refresh();

      return;
    }
    else
    if (this._status === C.STATUS_SUBSCRIBE_SENT ||
        this._status === C.STATUS_1XX_RECEIVED ||
        this._status === C.STATUS_WAITING_FOR_NOTIFY)
    {
      return;
    }

    const originalTarget = target;

    if (target === undefined || event === undefined)
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

    if (Utils.isDecimal(options.expires))
    {
      this._expires = options.expires;
    } 
    else 
    {
      debug('expires must be a decimal. Using default of 3600.');
      this._expires = SIP_C.SUBSCRIPTION_EXPIRES;
    }

    // Set event handlers.
    for (const handler in eventHandlers)
    {
      if (Object.prototype.hasOwnProperty.call(eventHandlers, handler))
      {
        this.on(handler, eventHandlers[handler]);
      }
    }

    this._target = target;
    this._event = event;
    this._options = options;
    this._contentType = contentType;

    delete this._options.eventHandlers;

    extraHeaders.push(`Event: ${this._event}`);
    extraHeaders.push(`Expires: ${this._expires}`);
    extraHeaders.push(`Contact: ${this._contact}`);
    extraHeaders.push(`Content-Type: ${this._contentType}`);

    this._request = new SIPMessage.OutgoingRequest(
      SIP_C.SUBSCRIBE, target, this._ua, null, extraHeaders);

    if (options.body)
    {
      this._request.body = options.body;
    }

    clearTimeout(this._timers.sub_duration);
    clearTimeout(this._timers.N);

    this._timers.N = setTimeout(() =>
    {
      this._timer_fire();
    },
    Timers.TIMER_N
    );

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

    request_sender.send();

    this._status = C.STATUS_SUBSCRIBE_SENT;
  }

  terminate()
  {
    if (this._status === C.STATUS_TERMINATED)
    {
      return;
    }
    else if (this._status === C.STATUS_ACTIVE)
    {
      const extraHeaders = [];

      extraHeaders.push(`Event: ${ this._event}`);
      extraHeaders.push('Expires: 0');
      extraHeaders.push(`Contact: ${ this._contact}`);
      extraHeaders.push(`Content-Type: ${this._contentType}`);

      this.sendRequest(SIP_C.SUBSCRIBE, {
        extraHeaders : extraHeaders,
        body         : this._request.body
      });
    }

    clearTimeout(this._timers.N);
    clearTimeout(this._timers.sub_duration);

    this._status = C.STATUS_TERMINATED;
    this._destroyDialog();
    this._ua.destroySubscription(this);
  }

  _receiveResponse(response)
  {
    if (this._status === C.STATUS_SUBSCRIBE_SENT && response.status_code >= 300)
    {
      const cause = Utils.sipErrorCause(response.status_code);

      this._failed('remote', response, cause);
    }

    if (this._status !== C.STATUS_SUBSCRIBE_SENT)
    {
      return;
    }

    switch (true)
    {
      case /^100$/.test(response.status_code):
        this._status = C.STATUS_1XX_RECEIVED;
        break;

      case /^1[0-9]{2}$/.test(response.status_code):
      {
        // Do nothing with 1xx responses without To tag.
        if (!response.to_tag)
        {
          debug('1xx response received without to tag');
          break;
        }

        // Create Early Dialog if 1XX comes with contact.
        if (response.hasHeader('contact'))
        {
          // An error on dialog creation will fire 'failed' event.
          if (! this._createDialog(response, 'UAS', true))
          {
            break;
          }
        }

        this._status = C.STATUS_1XX_RECEIVED;
        this._progress('remote', response);
        break;
      }

      case /^2[0-9]{2}$/.test(response.status_code):
      {
        // Do nothing with 1xx responses without To tag.
        if (!response.to_tag)
        {
          debug('2xx response received without to tag');
          break;
        }

        this._status = C.STATUS_WAITING_FOR_NOTIFY;

        const expires = response.getHeader('Expires');

        if (Utils.isDecimal(expires) && expires <= this._expires) 
        {
          // Preserve new expires value for subsequent requests
          this._expires = expires;
          this._timers.sub_duration = setTimeout(() =>
          {
            this._refresh();
          },
          expires * 900
          );
        }
        else 
        if (!expires) 
        {
          debug('Expires header missing in a 200-class response to SUBSCRIBE');
          this._failed('remote', response, SIP_C.causes.EXPIRES_HEADER_MISSING);
        }
        else 
        {
          this.logger.warn('Expires header in a 200-class response to SUBSCRIBE with a higher value than the one in the request');
          this._failed('remote', response, SIP_C.causes.INVALID_EXPIRES_HEADER);
        }

        if (response.hasHeader('contact'))
        {
          this._id = response.call_id + response.to_tag + this._event;
          this._newSubscription('local', this._request);
          this._succeeded('remote', response);
        }

        break;
      }

      default:
      {
        const cause = Utils.sipErrorCause(response.status_code);

        this._failed('remote', response, cause);
      }
    }
  }

  _onRequestTimeout()
  {
    this.terminate();
    this._failed('system', null, SIP_C.causes.REQUEST_TIMEOUT);
  }

  _onTransportError()
  {
    this.terminate();
    this._failed('system', null, SIP_C.causes.CONNECTION_ERROR);
  }

  /**
   * Internal Callbacks
   */

  _timer_fire()
  {
    if (this._status === C.STATUS_ACTIVE)
    {
      this.refresh();
    }
    else
    {
      this.terminate();
    }
  }

  _newSubscription(originator, request)
  {
    debug('new subscription');
    this._ua.newSubscription(this, {
      originator,
      subscription : this,
      request
    });
  }

  _refresh()
  {
    if (this._status === C.STATUS_ACTIVE) 
    {     
      this.sendRequest(SIP_C.SUBSCRIBE, {
        extraHeaders : this._request.extraHeaders,
        body         : this._request.body
      });
    }
  }

  /**
   * Dialog Management
   */
  _createDialog(message, type, early)
  {
    const local_tag = (type === 'UAS') ? message.to_tag : message.from_tag;
    const remote_tag = (type === 'UAS') ? message.from_tag : message.to_tag;
    const id = message.call_id + local_tag + remote_tag;

    let early_dialog = this._earlyDialogs[id];

    // Early Dialog.
    if (early)
    {
      if (early_dialog)
      {
        return true;
      }
      else
      {
        early_dialog = new Dialog(this, message, type, Dialog.C.STATUS_EARLY);

        // Dialog has been successfully created.
        if (early_dialog.error)
        {
          debug(early_dialog.error);
          this._failed('remote', message, SIP_C.causes.INTERNAL_ERROR);

          return false;
        }
        else
        {
          this._earlyDialogs[id] = early_dialog;

          return true;
        }
      }
    }

    // Confirmed Dialog.
    else
    {
      this._from_tag = message.from_tag;
      this._to_tag = message.to_tag;

      // In case the dialog is in _early_ state, update it.
      if (early_dialog)
      {
        early_dialog.update(message, type);
        this._dialog = early_dialog;
        this._dialog._local_seqnum = this._request.cseq;
        delete this._earlyDialogs[id];

        return true;
      }

      // Otherwise, create a _confirmed_ dialog.
      const dialog = new Dialog(this, message, type);

      if (dialog.error)
      {
        debug(dialog.error);
        this._failed('remote', message, SIP_C.causes.INTERNAL_ERROR);

        return false;
      }
      else
      {
        this._dialog = dialog;
        this._dialog._local_seqnum = this._request.cseq;

        return true;
      }
    }
  }

  _destroyDialog()
  {
    // Terminate confirmed dialog.
    if (this._dialog)
    {
      this._dialog.terminate();
      delete this._dialog;
    }

    // Terminate early dialogs.
    for (const dialog in this._earlyDialogs)
    {
      if (Object.prototype.hasOwnProperty.call(this._earlyDialogs, dialog))
      {
        this._earlyDialogs[dialog].terminate();
        delete this._earlyDialogs[dialog];
      }
    }
  }

  _matchEvent(request)
  {
    // Check mandatory header Event
    if (!request.hasHeader('Event')) 
    {
      debug('missing Event header');
      
      return false;
    }
    // Check mandatory header Subscription-State
    if (!request.hasHeader('Subscription-State')) 
    {
      debug('missing Subscription-State header');
      
      return false;
    }

    // Check whether the event in NOTIFY matches the event in SUBSCRIBE
    const event = request.parseHeader('event').event;

    if (this._event !== event) 
    {
      debug('event match failed');
      request.reply(481, 'Event Match Failed');
      
      return false;
    }
    else 
    {
      return true;
    }
  }

  /**
   * Send a generic in-dialog Request
   */
  sendRequest(method, options)
  {
    debug('sendRequest()');

    options.eventHandlers = {
      onSuccessResponse : (response) =>
      {    
        this._succeeded('remote', response);
      },
      onErrorResponse : (response) =>
      {    
        this._failed('remote', response, SIP_C.causes.SIP_FAILURE_CODE);
      },
      onTransportError : () =>
      {
        this._onTransportError();
      },
      onRequestTimeout : () =>
      {
        this._onRequestTimeout();
      },
      onDialogError : (response) =>
      {    
        this._failed('local', response, SIP_C.causes.DIALOG_ERROR);
      }
    };

    return this._dialog.sendRequest(method, options);
  }

  /**
   * In dialog Request Reception
   */
  receiveRequest(request)
  {
    debug('receiveRequest()');

    if (!this._matchEvent(request)) 
    { // checks event and subscription_state headers
      request.reply(489);
      
      return;
    }

    if (!this._dialog) 
    {
      if (!this._createDialog(request, 'UAS', false)) 
      {
        debug('failed to create comfirm dialog');
      }
    }

    const sub_state = request.parseHeader('Subscription-State');

    request.reply(200);

    clearTimeout(this._timers.N);

    if (request.body)
      this._notify('remote', request);

    if (this._status === C.STATUS_TERMINATED) 
    {
      debug('received notify while subscription is terminated'); 

      return;
    }

    switch (sub_state.state) 
    {
      case 'active':
        setExpiresTimeout.call(this);
        this._status = C.STATUS_ACTIVE;
        break;
      case 'pending':
        if (this.state === C.STATUS_WAITING_FOR_NOTIFY ||
            this.state === C.STATUS_SUBSCRIBE_SENT) 
        {
          setExpiresTimeout.call(this);
        }
        this.state = C.STATUS_PENDING;
        break;
      case 'terminated':
        clearTimeout(this._timers.sub_duration);
        if (sub_state.reason) 
        {
          debug(`terminating subscription with reason ${ sub_state.reason}`);
          switch (sub_state.reason) 
          {
            case 'deactivated':
            case 'timeout':
              this.subscribe(this._target, this._event, this._options);
    
              return;
            case 'probation':
            case 'giveup':
              if (sub_state.params && sub_state.params['retry-after']) 
              {
                this.timers.sub_duration = setTimeout(() =>
                {
                  this.subscribe(this._target, this._event, this._options);
                },
                sub_state.params['retry-after']);
              }
              else 
              {
                this.subscribe(this._target, this._event, this._options);
              }
              
              return;
            case 'rejected':
            case 'noresource':
            case 'invariant':
              break;
          }
        }
        this.terminate();
        break;
    }

    function setExpiresTimeout() 
    {
      if (sub_state.expires) 
      {
        clearTimeout(this._timers.sub_duration);

        sub_state.expires = Math.min(this._expires,
          Math.max(sub_state.expires, 0));

        this._timers.sub_duration = setTimeout(() =>
        {
          this._refresh();
        },
        sub_state.expires * 900);
      }
    }
  }

  _notify(originator, request)
  {
    debug('emit "notify"');

    this.emit('notify', {
      originator,
      request : request || null,
      notify  : request.body
    });
  }

  _progress(originator, response)
  {
    debug('subscription progress');

    this.emit('progress', {
      originator,
      response : response || null
    });
  }

  _succeeded(originator, response)
  {
    debug('subscription successed');

    this.emit('successed', {
      originator,
      response : response || null
    });
  }

  _failed(originator, response, cause)
  {
    debug('subscription failed');

    this.terminate();

    this.emit('failed', {
      originator,
      response : response || null,
      cause
    });
  }
};
