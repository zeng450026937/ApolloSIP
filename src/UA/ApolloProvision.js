const EventEmitter = require('events').EventEmitter;
const Utils = require('../Base/Utils');
const debug = require('../Base/Debug')('Apollo:Provision');

const PROVISION_GROUP = {
  SERVER_CONFIGURATION   : 'serverConfiguration',
  ENDPOINT_CONFIGURATION : 'endpointConfiguration'
};

module.exports = class ApolloProvision extends EventEmitter 
{
  static get PROVISION_GROUP() 
  {
    return PROVISION_GROUP;
  }

  constructor(ua) 
  {
    super();
    this._ua = ua;
    this._target = ua.get('uri');
    this._expires = 3600;
    this._event = 'apollo-provisioning';
    this._contentType = 'application/apollo-provisioning+xml';
    this._extraHeaders = [ `Accept: ${this._contentType}` ];
    this._subscription = null;
  }

  get PROVISION_GROUP() 
  {
    return PROVISION_GROUP;
  }

  subscribe(provisionGroup) 
  {
    const body = {
      provisionGroupList : {
        provisionGroup : []
      }
    };

    if (!Array.isArray(provisionGroup))
    {
      provisionGroup = [ provisionGroup ];
    }

    for (const provision of provisionGroup) 
    {
      body.provisionGroupList.provisionGroup.push({
        '@name' : provision
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

    if (obj && obj['provisionGroupList']) 
    {
      const provisionGroupList = obj['provisionGroupList'];

      if (provisionGroupList) 
      {
        const provisionGroup = provisionGroupList['provisionGroup'];
        let provisionName = '';

        for (const provision of provisionGroup) 
        {
          provisionName = provision['@name'];

          switch (provisionName) 
          {
            case PROVISION_GROUP.SERVER_CONFIGURATION:
              this.emit('notify', PROVISION_GROUP.SERVER_CONFIGURATION, provision);
              break;
            case PROVISION_GROUP.ENDPOINT_CONFIGURATION:
              this.emit('notify', PROVISION_GROUP.ENDPOINT_CONFIGURATION, provision);
              break;
            default:
              break;
          }
        }
      }
    }
  }
};
