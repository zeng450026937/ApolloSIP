const EventEmitter = require('events').EventEmitter;
const Url = require('url');
const Call = require('./Call');
const ConferenceManager = require('./ConferenceManager');
const Media = require('./Media');
const UA = require('./UA');
const SIP = require('./SIP');
const Exceptions = SIP.Exceptions;
const debug = SIP.debug('Apollo:Phone');

const C = {
  STATUS_NULL       : 0, 
  STATUS_NEW        : 1,
  STATUS_CONNECTING : 2,
  STATUS_CONNECTED  : 3,
  STATUS_COMPLETED  : 4
};

class Phone extends EventEmitter
{
  constructor(configuration = {})
  {
    super();

    this._configuration = {
      // common configuration
      product              : 'cloud',
      pathname             : '/meeting/join',
      debugPort            : 8081,
      username             : undefined,
      password             : undefined,
      domain               : 'mcu.leucs.com',
      server               : '10.86.0.199',
      proxy                : undefined,
      display_name         : 'Yealink',
      authorization_user   : undefined,
      session_timers       : false,
      user_agent           : 'Yealink SIP-WEB',
      debug                : true,
      // peer connection config
      iceServers           : [ { urls: 'stun:stun.l.google.com:19302' } ],
      iceTransportPolicy   : 'all',
      iceCandidatePoolSize : 0,
      // rtc config
      DtlsSrtpKeyAgreement : false,
      googIPv6             : false,
      // rtc offer/answer config
      // the number of audio streams to receive when creating an offer.
      offerToReceiveAudio  : 1,
      // the number of video streams to receive when creating an offer.
      offerToReceiveVideo  : 1,
      // apollo service config
      conferenceFactoryUri : undefined,
      capabilities         : undefined,
      negotiateUrl         : undefined,
      phonebookUrl         : undefined,
      // call config
      anonymous            : false
    };

    Object.assign(this._configuration, configuration);

    this._media = new Media();
    this._ua = null;
    this._cm = null;
    
    this._call = null;
    this._calls = {};
    this._conference = null;

    this._state = C.STATUS_NULL;
  }

  get media()
  {
    return this._media;
  }

  get call()
  {
    return this._call;
  }

  get conference()
  {
    return this._conference;
  }

  isInitialized()
  {
    return this._ua ? true : false;
  }

  isConnected()
  {
    return this._ua && this._ua.isConnected();
  }

  isRegistered()
  {
    return this._ua && this._ua.isRegistered();
  }
  
  get(parameter)
  {
    switch (parameter)
    {
      case 'product':
        return this._configuration.product;

      case 'pathname':
        return this._configuration.pathname;

      case 'debugPort':
        return this._configuration.debugPort;

      case 'username':
        return this._configuration.username;

      case 'password':
        return this._configuration.password;

      case 'domain':
        return this._configuration.domain;

      case 'proxy':
        return this._configuration.proxy;

      case 'display_name':
        return this._configuration.display_name;

      case 'authorization_user':
        return this._configuration.authorization_user;

      case 'session_timers':
        return this._configuration.session_timers;

      case 'user_agent':
        return this._configuration.user_agent;

      case 'debug':
        return this._configuration.debug;
        
      default:
        return this._ua.get(parameter);
    }
  }

  set(parameter, value)
  {
    switch (parameter)
    {
      case 'product':
        this._configuration.product = value;
        break;

      case 'pathname':
        this._configuration.pathname = value;
        break;

      case 'debugPort':
        this._configuration.debugPort = value;
        break;

      case 'username':
        this._configuration.username = value;
        break;

      case 'password':
        this._configuration.password = value;
        break;

      case 'domain':
        this._configuration.domain = value;
        break;

      case 'proxy':
        this._configuration.proxy = value;
        break;

      case 'authorization_user':
        this._configuration.authorization_user = value;
        break;

      case 'session_timers':
        this._configuration.session_timers = value;
        break;

      case 'user_agent':
        this._configuration.user_agent = value;
        break;
        
      case 'debug':
        this._configuration.debug = value;
        break;

      default:
        return this._ua.set(parameter, value);
    }
  }

  initialize()
  {
    debug('initialize()');

    if (this.isInitialized())
    {
      return;
    }

    const hostname = document.location.hostname;
    const secure = document.location.protocol === 'https:'?true:false;
    const port = document.location.port;
    const pathname = this._configuration.pathname;
    const debugPort = this._configuration.debugPort;
    const server = this._configuration.server;
    const proxy = this._configuration.proxy;
    const username = this._configuration.username;
    const password = this._configuration.password;
    const domain = this._configuration.domain;

    let uri;

    let proxyUrl = proxy ? proxy : Url.format({
      protocol : secure?'wss':'ws',
      hostname : hostname,
      port     : port==debugPort?4443:port,
      pathname : window.location.href.indexOf(pathname)>=0?pathname:'/',
      slashes  : true
    });

    let accountServer;
    let needQueryAccount = true;

    if (username && password)
    {
      needQueryAccount = false;
      uri = `${username}@${domain}`;
    }

    if (needQueryAccount)
    {
      if (!accountServer)
      {
        accountServer = proxyUrl;
      }

      queryAccount.call(this, accountServer)
        .catch((e) =>
        {
          queryFailed.call(this, e);
        })
        .then((account) =>
        {
          querySuccessed.call(this, account);
        })
        .catch((e) =>
        {
          this.emit('initializeFailed', { error: e });
        });
    }
    else
    {
      querySuccessed.call(this, {
        uri      : uri,
        password : password
      });
    }

    function queryAccount(url) 
    {
      debug('account server: %s', url);

      return new Promise((resolve, reject) => 
      {
        const socket = new WebSocket(url);
    
        socket.onopen = () =>
        {
          socket.send('getreginfo\r\n');
        };
        socket.onmessage = (msg) =>
        {
          const account = JSON.parse(msg.data);
  
          socket.close();
          resolve(account);
        };
        socket.onerror = (e) =>
        {
          reject(e);
        };
      });
    }

    function querySuccessed(account)
    {
      if (!account.uri)
        account.uri = `${account.username}@${domain}`;
      
      debug('accountQueried : %o', account);

      if (needQueryAccount)
        this.emit('accountQueried', { account: account });

      this._checkCompatibility();

      proxyUrl = Url.parse(proxyUrl);

      const serverUrl = Url.format({
        protocol : proxyUrl.protocol,
        hostname : proxyUrl.hostname,
        port     : proxyUrl.port,
        pathname : proxyUrl.pathname + server?server:domain,
        slashes  : true
      });

      const socket = new SIP.WebSocketInterface(serverUrl);
  
      const configuration = {
        server               : '',
        outbound             : '',
        sockets              : [ socket ],
        uri                  : account.uri,
        password             : account.password,
        display_name         : this._configuration.display_name,
        session_timers       : this._configuration.session_timers,
        user_agent           : this._configuration.user_agent,
        debug                : this._configuration.debug,
        iceServers           : this._configuration.iceServers,
        iceTransportPolicy   : this._configuration.iceTransportPolicy,
        iceCandidatePoolSize : this._configuration.iceCandidatePoolSize,
        DtlsSrtpKeyAgreement : this._configuration.DtlsSrtpKeyAgreement,
        googIPv6             : this._configuration.googIPv6,
        offerToReceiveAudio  : this._configuration.offerToReceiveAudio,
        offerToReceiveVideo  : this._configuration.offerToReceiveVideo
      };
    
      this._ua = new UA(configuration);
      this._cm = new ConferenceManager(this._ua);

      const eventHandlers = {
        connecting         : this.onConnecting.bind(this),
        connected          : this.onConnected.bind(this),
        disconnected       : this.onDisconnected.bind(this),
        registered         : this.onRegistered.bind(this),
        unregistered       : this.onUnregistered.bind(this),
        registrationFailed : this.onRegistrationFailed.bind(this),
        newRTCSession      : this.onNewRTCSession.bind(this),
        newMessage         : this.onNewMessage.bind(this),
        newService         : this.onNewService.bind(this)
      };
      
      for (const event in eventHandlers)
      {
        if (Object.prototype.hasOwnProperty.call(eventHandlers, event))
        {
          this._ua.on(event, eventHandlers[event]);
        }
      }

      this.emit('initialized');
    }

    function queryFailed(e)
    {
      if (needQueryAccount)
        this.emit('accountQueryFailed', { error: e });
    }
  }

  start()
  {
    debug('start()');

    this._checkInitialization();

    this._ua.start();
  }

  stop()
  {
    debug('stop()');

    this._checkInitialization();

    this._ua.stop();
  }

  register()
  {
    debug('register()');

    this._checkInitialization();

    this._ua.register();
  }

  unregister()
  {
    debug('unregister()');

    this._checkInitialization();

    this._ua.unregister();
  }

  outgoing(target)
  {
    debug('outgoing()');

    this._checkInitialization();

    const call = new Call(this, target, Call.TYPE.MAIN, this._media);

    call.connect();

    return call;
  }

  answer(from)
  {
    debug('answer()');

    this._checkInitialization();
  }

  reject()
  {
    debug('reject()');

    this._checkInitialization();
  }

  refer(target)
  {
    debug('refer()');

    this._checkInitialization();
  }

  hangup()
  {
    debug('hangup()');

    this._checkInitialization();
  }

  toggleHold(hold, options = { video: true, audio: true })
  {
    debug('toggleHold()');

    this._checkInitialization();
  }

  toggleMute(mute, options = { video: true, audio: true })
  {
    debug('toggleMute()');

    this._checkInitialization();
  }

  sendDTMF()
  {
    debug('sendDTMF()');

    this._checkInitialization();
  }

  sendMessage(target, body, options)
  {
    debug('sendMessage()');

    this._checkInitialization();

    const message = this._ua.sendMessage(target, body, options);

    return message;
  }

  dialIn(conferenceNumber, conferencePIN)
  {
    debug('dialIn()');

    this._checkInitialization();

    return this._cm.dialIn(this._media, conferenceNumber, conferencePIN)
      .then((conference) =>
      {
        this._conference = conference;

        conference.once('ended', () =>
        {
          this._conference = null;
        });

        return Promise.resolve(conference);
      });
  }

  meetnow(participants)
  {
    debug('meetnow()');

    this._checkInitialization();

    return this._cm.meetnow(this._media, participants)
      .then((conference) =>
      {
        this._conference = conference;

        conference.once('ended', () =>
        {
          this._conference = null;
        });

        return Promise.resolve(conference);
      });
  }

  upgrade(participants)
  {
    debug('upgrade()');

    this._checkInitialization();

    const call = null;

    return this._cm.upgrade(call, participants)
      .then((conference) =>
      {
        this._conference = conference;

        conference.once('ended', () =>
        {
          this._conference = null;
        });
      
        return Promise.resolve(conference);
      });
  }

  _newCall(call)
  {
    this._calls[call.local_identity + call.remote_identity] = call;
  }

  _destroyCall(call)
  {
    delete this._calls[call.local_identity + call.remote_identity];
  }

  _checkCompatibility() 
  {
    const env = global.window || global;
    const RTC = {
      MediaStream           : env.MediaStream,
      getUserMedia          : env.navigator.mediaDevices.getUserMedia,
      RTCPeerConnection     : env.RTCPeerConnection,
      RTCSessionDescription : env.RTCSessionDescription
    };

    if (!RTC.getUserMedia || !RTC.MediaStream ||
     !RTC.RTCPeerConnection || !RTC.RTCSessionDescription) 
    {
      throw new Exceptions.NotSupportedError('WebRTC Not Supported');
    }
  }

  _checkInitialization()
  {
    if (!this.isInitialized())
    {
      throw new Exceptions.NotReadyError();
    }
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

  onNewService(data)
  {
    this.emit('newService', data);
  }

}

module.exports = Phone;