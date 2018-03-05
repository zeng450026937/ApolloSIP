const EventEmitter = require('events').EventEmitter;
const Utils = require('./Utils');
const debug = require('./SIP').debug('Apollo:Control');

const CONTROL_GROUP = {
  DEVICE_CONTROL : 'deviceControl',
  CONFIG_CONTROL : 'configControl',
  NOTICE_CONTROL : 'noticeControl'
};

class ApolloControl extends EventEmitter 
{
  static get CONTROL_GROUP() 
  {
    return CONTROL_GROUP;
  }

  constructor(ua) 
  {
    super();
    this._ua = ua;
    this._target = ua.get('uri');
    this._expires = 3600;
    this._event = 'apollo-control';
    this._contentType = 'application/conference-ctrl+xml';
    this._extraHeaders = [ `Accept: ${this._contentType}` ];
    this._subscription = null;
  }

  subscribe(controlGroup) 
  {
    debug('subscribe()');

    const body = {
      controlGroupList : {
        controlGroup : []
      }
    };

    if (!Array.isArray(controlGroup))
    {
      controlGroup = [ controlGroup ];
    }

    for (const control of controlGroup) 
    {
      body.controlGroupList.controlGroup.push({
        '@name' : control
      });
    }

    this._subscription = this._ua.subscribe(this._target, this._event, {
      expires       : this._expires,
      extraHeaders  : this._extraHeaders,
      body          : Utils.xmlify(body),
      contentType   : this._contentType,
      eventHandlers : {
        progress : () =>
        {
          debug('subscription progress.');
        },
        successed : () =>
        {
          debug('subscription successed.');
        },
        failed : (data) =>
        {
          debug('subscription failed. %s', data.cause);
        },
        notify : (data) =>
        {
          this.onNotify(data);
        }
      }
    });
  }

  unsubscribe()
  {
    debug('unsubscribe()');

    if (this._subscription)
    {
      this._subscription.terminate();
    }
  }

  onNotify(data) 
  {
    debug('onNotify: %o', data);

    const xml = data.notify;
    const obj = Utils.objectify(xml);

    if (obj && obj['request']) 
    {
      const request = obj['request'];
      const descript = request['descript'];
      const body = request['body'];

      if (descript['method'] === 'apollo-control') 
      {
        const controlGroup = body['controlGroupList']['controlGroup'];
        const controlGroupName = controlGroup['@name'];

        switch (controlGroupName) 
        {
          case CONTROL_GROUP.CONFIG_CONTROL:
            this.emit('notify', CONTROL_GROUP.CONFIG_CONTROL, controlGroup);
            break;
          case CONTROL_GROUP.DEVICE_CONTROL:
            this.emit('notify', CONTROL_GROUP.DEVICE_CONTROL, controlGroup);
            break;
          case CONTROL_GROUP.NOTICE_CONTROL:
            this.emit('notify', CONTROL_GROUP.NOTICE_CONTROL, controlGroup);
            break;
          default:
            break;
        }
      }
    }
  }
}

module.exports = ApolloControl;