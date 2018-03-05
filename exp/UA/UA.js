const SIP = require('../Base/SIP');
const Url = require('url');
const ApolloControl = require('./ApolloControl');
const ApolloProvision = require('./ApolloProvision');
const debug = SIP.debug('Apollo:UA');

module.exports = class UA extends SIP.UA
{
  constructor(configuration)
  {  
    const serverUrl = Url.parse(configuration.server);
    const outbound = configuration.outbound;

    const socketUrl = Url.format({
      protocol : serverUrl.protocol,
      hostname : serverUrl.hostname,
      port     : serverUrl.port,
      pathname : serverUrl.pathname + outbound,
      slashes  : true
    });

    const socket = new SIP.WebSocketInterface(socketUrl);

    configuration.sockets = [ socket ];

    super(configuration);

    Object.assign(this._configuration, {
      // common config
      server               : undefined,
      debug                : true,
      // peer connection config
      iceServers           : undefined, // [ { urls: 'stun:stun.l.google.com:19302' } ]
      iceTransportPolicy   : 'all',
      iceCandidatePoolSize : 0,
      // rtc config
      DtlsSrtpKeyAgreement : true,
      googIPv6             : false,
      // rtc offer/answer config
      // the number of audio streams to receive when creating an offer.
      offerToReceiveAudio  : 1,
      // the number of video streams to receive when creating an offer.
      offerToReceiveVideo  : 1,
      // call config
      anonymous            : false,
      // apollo service config
      conferenceFactoryUri : undefined,
      capabilities         : undefined,
      negotiateUrl         : undefined,
      phonebookUrl         : undefined
    });

    const optional = [
      'server',
      'debug',
      'iceServers',
      'iceTransportPolicy',
      'iceCandidatePoolSize',
      'DtlsSrtpKeyAgreement',
      'googIPv6',
      'offerToReceiveAudio',
      'offerToReceiveVideo',
      'anonymous'          
    ];

    for (const parameter of optional)
    {
      if (configuration.hasOwnProperty(parameter))
      {
        const value = configuration[parameter];

        if (SIP.Utils.isEmpty(value))
        {
          continue;
        }

        this._configuration[parameter] = value;
      }
    }

    if (this._configuration.debug)
    {
      SIP.debug.enable('SIP:* Apollo:*');
    }

    this._apolloControl = null;
    this._apolloProvision = null;
  }

  get(parameter)
  {
    switch (parameter)
    {
      case 'iceServers':
        return this._configuration.iceServers;

      case 'iceTransportPolicy':
        return this._configuration.iceTransportPolicy;

      case 'iceCandidatePoolSize':
        return this._configuration.iceCandidatePoolSize;
        
      case 'DtlsSrtpKeyAgreement':
        return this._configuration.DtlsSrtpKeyAgreement;
        
      case 'googIPv6':
        return this._configuration.googIPv6;

      case 'offerToReceiveAudio':
        return this._configuration.offerToReceiveAudio;

      case 'offerToReceiveVideo':
        return this._configuration.offerToReceiveVideo;
        
      case 'conferenceFactoryUri':
        return this._configuration.conferenceFactoryUri;

      case 'capabilities':
        return this._configuration.capabilities;

      case 'negotiateUrl':
        return this._configuration.negotiateUrl;
        
      case 'phonebookUrl':
        return this._configuration.phonebookUrl;

      case 'anonymous':
        return this._configuration.anonymous;

      case 'uri':
        return this._configuration.uri;

      default:
        return super.get(parameter);
    }
  }

  set(parameter, value)
  {
    switch (parameter)
    {
      case 'iceServers':
        this._configuration.iceServers = value;
        break;

      case 'iceTransportPolicy':
        this._configuration.iceTransportPolicy = value;
        break;

      case 'iceCandidatePoolSize':
        this._configuration.iceCandidatePoolSize = value;
        break;

      case 'DtlsSrtpKeyAgreement':
        this._configuration.DtlsSrtpKeyAgreement = value;
        break;

      case 'googIPv6':
        this._configuration.googIPv6 = value;
        break;

      case 'offerToReceiveAudio':
        this._configuration.offerToReceiveAudio = value;
        break;

      case 'offerToReceiveVideo':
        this._configuration.offerToReceiveVideo = value;
        break;

      case 'conferenceFactoryUri':
        this._configuration.conferenceFactoryUri = value;
        break;

      case 'capabilities':
        this._configuration.capabilities = value;
        break;

      case 'negotiateUrl':
        this._configuration.negotiateUrl = value;
        break;
        
      case 'phonebookUrl':
        this._configuration.phonebookUrl = value;
        break;

      case 'anonymous':
        this._configuration.anonymous = value;
        break;

      default:
        return super.set(parameter, value);
    }
  }

  registered(data)
  {
    super.registered(data);

    this.subscribeApolloService();
  }

  registrationFailed(data)
  {
    debug(`registrationFailed: ${data.cause}`);

    if (data.cause && data.cause === SIP.C.causes.REDIRECTED)
    {
      debug('Try redirect');

      const response = data.response;
      let contacts = response.getHeaders('contact').length;
      let contact = null;
      let socketUrl = '';
      const sockets = [];

      const serverUrl = Url.parse(this._configuration.server);

      while (contacts--) 
      {
        contact = response.parseHeader('contact', contacts);
        socketUrl = Url.format({
          pathname : serverUrl.pathname + contact.uri.host,
          hostname : serverUrl.hostname,
          port     : serverUrl.port,
          protocol : serverUrl.protocol,
          slashes  : true
        });
        const socket = new SIP.WebSocketInterface(socketUrl.toString());

        sockets.push({ socket: socket });
      }

      this.stop();
      this.once('disconnected', () =>
      {
        this._transport._setSocket(sockets);
        this._transport._getSocket();
        this.start();
      });
    }
    else
    {
      super.registrationFailed(data);
    }
  }

  subscribeApolloService()
  {
    // subscribe apollo control
    if (!this._apolloControl) 
    {
      this._apolloControl = new ApolloControl(this);
      this._apolloControl.on('notify', this.onApolloControl.bind(this));
    }

    this._apolloControl.subscribe([
      ApolloControl.CONTROL_GROUP.DEVICE_CONTROL,
      ApolloControl.CONTROL_GROUP.CONFIG_CONTROL,
      ApolloControl.CONTROL_GROUP.NOTICE_CONTROL
    ]);

    // subscribe apollo provision
    if (!this._apolloProvision) 
    {
      this._apolloProvision = new ApolloProvision(this);
      this._apolloProvision.on('notify', this.onApolloProvision.bind(this));
    }

    this._apolloProvision.subscribe([
      ApolloProvision.PROVISION_GROUP.SERVER_CONFIGURATION,
      ApolloProvision.PROVISION_GROUP.ENDPOINT_CONFIGURATION
    ]);
  }

  onApolloControl(controlGroup, configuration) 
  {
    const action = configuration['action'];
    const actionName = action['@name'];

    switch (controlGroup) 
    {
      case ApolloControl.CONTROL_GROUP.CONFIG_CONTROL:
        if (actionName === 'turnRefresh') 
        {
          const servers = action['configGroup'];
          const iceServers = [];

          for (const server of servers) 
          {
            const { Server, UDPPort, Username, Password } = server;

            iceServers.push({
              urls : Url.format({
                hostname : Server,
                port     : UDPPort,
                protocol : Username ? 'turn' : 'stun',
                slashes  : false
              }),
              username   : Username,
              credential : Password
            });
          }
          this.set('iceServers', iceServers);
          this.emit('iceServerUpdated', iceServers);
          debug('iceServerUpdated : %o', iceServers);
        }
        break;
      case ApolloControl.CONTROL_GROUP.DEVICE_CONTROL:
        break;
      case ApolloControl.CONTROL_GROUP.NOTICE_CONTROL:
        if (actionName === 'bookConferenceUpdate') 
        {
          this.emit('bookConferenceUpdated', action['xml-body']);
          debug('bookConferenceUpdated : %o', action['xml-body']);
        }
        break;
    }
  }

  onApolloProvision(provisionGroup, configuration) 
  {
    switch (provisionGroup) 
    {
      case ApolloProvision.PROVISION_GROUP.ENDPOINT_CONFIGURATION:
        for (const attr in configuration) 
        {
          if (configuration.hasOwnProperty(attr)) 
          {
            const value = configuration[attr];
            
            if (attr === 'phonebook-url') 
            {
              const phonebookUrl = value['@url'];

              this.set('phonebookUrl', phonebookUrl);
              this.emit('phonebookUrlUpdated', phonebookUrl);
              debug('phonebookUrlUpdated : %s', phonebookUrl);
            }
            if (attr === 'negotiate-url') 
            {
              const negotiateUrl = value['@url'];

              this.set('negotiateUrl', negotiateUrl);
              this.emit('negotiateUrlUpdated', negotiateUrl);
              debug('negotiateUrlUpdated : %s', negotiateUrl);
            }
          }
        }
        break;
      case ApolloProvision.PROVISION_GROUP.SERVER_CONFIGURATION:
        for (const attr in configuration) 
        {
          if (configuration.hasOwnProperty(attr)) 
          {
            const value = configuration[attr];

            if (attr === 'conference-factory-uri') 
            {
              const conferenceFactoryUri = value;

              this.set('conferenceFactoryUri', conferenceFactoryUri);
              this.emit('conferenceFactoryUriUpdated', conferenceFactoryUri);
              debug('conferenceFactoryUriUpdated : %s', conferenceFactoryUri);
            }
            if (attr === 'capabilities') 
            {
              const capabilities = value;

              this.set('capabilities', capabilities);
              this.emit('capabilitiesUpdated', capabilities);
              debug('capabilitiesUpdated : %o', capabilities);
            }
          }
        }
        break;
    }
  }
};