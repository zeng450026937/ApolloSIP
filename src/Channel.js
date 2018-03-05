const EventEmitter = require('events').EventEmitter;
const Utils = require('./Utils');
const SDPTransform = require('sdp-transform');
const SIP = require('./SIP');
const debug = SIP.debug('Apollo:Channel');

const TYPE = {
  MAIN   : 'main',
  SLIDES : 'slides'
};

module.exports = class Channel extends EventEmitter
{
  static get TYPE()
  {
    return TYPE;
  }

  constructor(ua, target, type = TYPE.MAIN)
  {
    super();

    this._ua = ua;
    this._target = target;
    this._session = null;
    this._type = type;
    this._conferenceId = {};
    this._eventHandlers = {
      'peerconnection'                            : this._peerconnection.bind(this),
      'connecting'                                : this._connecting.bind(this),
      'sending'                                   : this._sending.bind(this),
      'progress'                                  : this._progress.bind(this),
      'accepted'                                  : this._accepted.bind(this),
      'confirmed'                                 : this._confirmed.bind(this),
      'ended'                                     : this._ended.bind(this),
      'failed'                                    : this._failed.bind(this),
      'newDTMF'                                   : this._newDTMF.bind(this),
      'newInfo'                                   : this._newInfo.bind(this),
      'hold'                                      : this._hold.bind(this),
      'unhold'                                    : this._unhold.bind(this),
      'muted'                                     : this._muted.bind(this),
      'unmuted'                                   : this._unmuted.bind(this),
      'reinvite'                                  : this._reinvite.bind(this),
      'update'                                    : this._update.bind(this),
      'refer'                                     : this._refer.bind(this),
      'replaces'                                  : this._replaces.bind(this),
      'sdp'                                       : this._sdp.bind(this),
      'getusermediafailed'                        : this._getusermediafailed.bind(this),
      'peerconnection:createofferfailed'          : this._createofferfailed.bind(this),
      'peerconnection:createanswerfailed'         : this._createanswerfailed.bind(this),
      'peerconnection:setlocaldescriptionfailed'  : this._setlocaldescriptionfailed.bind(this),
      'peerconnection:setremotedescriptionfailed' : this._setremotedescriptionfailed.bind(this)
    };
  }

  connect(options = {})
  {
    const _options = Object.assign({}, this._fetchOptions(), options);

    const session = this._ua.call(this._target, _options);

    this.attach(session);
  }

  attach(session)
  {
    this._session = session;
    Utils.setupEventHandlers(this._session, this._eventHandlers);
  }
  dettach()
  {
    Utils.removeEventHandlers(this._session, this._eventHandlers);
  }

  get type()
  {
    return this._type;
  }
  get session()
  {
    return this._session;
  }
  get connection()
  {
    return this._session.connection;
  }
  get direction()
  {
    return this._session.direction;
  }
  get local_identity()
  {
    return this._session.local_identity;
  }
  get remote_identity()
  {
    return this._session.remote_identity;
  }
  get start_time()
  {
    return this._session.start_time;
  }
  get end_time()
  {
    return this._session.end_time;
  }
  get data()
  {
    return this._session.data;
  }

  isAvariable()
  {
    return this._session?true:false;
  }
  isInProgress()
  {
    return this._session.isInProgress();
  }
  isEstablished()
  {
    return this._session.isEstablished();
  }
  isEnded()
  {
    return this._session.isEnded();
  }
  isReadyToReOffer()
  {
    return this._session.isReadyToReOffer();
  }
  isInConference()
  {
    const { focusUri, entity } = this._conferenceId;

    return (focusUri && entity) ? true : false;
  }

  answer(options)
  {
    return this._session.answer(options);
  }
  terminate(options)
  {
    return this._session.terminate(options);
  }
  sendDTMF(tone, options)
  {
    return this._session.sendDTMF(tone, options);
  }
  sendInfo(contentType, body, options)
  {
    return this._session.sendInfo(contentType, body, options);
  }
  hold(options, done)
  {
    return this._session.hold(options, done);
  }
  unhold(options, done)
  {
    return this._session.unhold(options, done);
  }
  renegotiate(options, done)
  {
    return this._session.renegotiate(options, done);
  }
  isOnHold()
  {
    return this._session.isOnHold();
  }
  mute(options)
  {
    return this._session.mute(options);
  }
  unmute(options)
  {
    return this._session.unmute(options);
  }
  isMuted()
  {
    return this._session.isMuted();
  }
  refer(target, options)
  {
    return this._session.refer(target, options);
  }

  _fetchOptions()
  {
    const extraHeaders = [];
    const sessionTimersExpires = 120;

    const options = {
      mediaConstraints : null,
      mediaStream      : null,
      pcConfig         : {
        iceServers           : this._ua.get('iceServers'),
        iceTransportPolicy   : this._ua.get('iceTransportPolicy'),
        iceCandidatePoolSize : this._ua.get('iceCandidatePoolSize')
      },
      rtcConstraints : {
        optional : [
          { DtlsSrtpKeyAgreement: this._ua.get('DtlsSrtpKeyAgreement') },
          { googIPv6: this._ua.get('googIPv6') }
        ]
      },
      rtcOfferConstraints : {
        offerToReceiveAudio : this._ua.get('offerToReceiveAudio'),
        offerToReceiveVideo : this._ua.get('offerToReceiveVideo')
      },
      rtcAnswerConstraints : {
        offerToReceiveAudio : this._ua.get('offerToReceiveAudio'),
        offerToReceiveVideo : this._ua.get('offerToReceiveVideo')
      },
      extraHeaders         : extraHeaders,
      anonymous            : this._ua.get('anonymous'),
      sessionTimersExpires : sessionTimersExpires
    };

    return options;
  }

  _peerconnection(data)
  {
    debug('on peerconnection');

    this.emit('peerconnection', data);
  }
  _connecting(data) 
  {
    debug('on connecting');

    this.emit('connecting', data);
  }
  _sending(data) 
  {
    debug('on sending');

    this.emit('sending', data);
  }
  _progress(data) 
  {
    debug('on progress: %s', data.originator);
    
    this.emit('progress', data);
  }
  _accepted(data) 
  {
    debug('on accepted: %s', data.originator);

    let focusUri, entity;
    const response = data.response;

    if (response.hasHeader('apollo-focus-uri')) 
    {
      focusUri = response.getHeader('apollo-focus-uri');
      focusUri = SIP.Grammar.parse(focusUri, 'Contact')[0].parsed.uri.toString();
    }
    if (response.hasHeader('Apollo-Conference-Entity')) 
    {
      entity = response.getHeader('Apollo-Conference-Entity');
    }

    if (focusUri && entity) 
    {
      this._conferenceId = {
        focusUri : focusUri,
        entity   : entity
      };
    }
    
    this.emit('accepted', data);
  }
  _confirmed(data) 
  {
    debug('on confirmed: %s', data.originator);
    
    this.emit('confirmed', data);
  }
  _ended(data) 
  {
    debug('on ended: %s, cause: %s', data.originator, data.cause);

    this.dettach();

    this.emit('ended', data);
  }
  _failed(data) 
  {
    debug('on failed: %s, cause: %s', data.originator, data.cause);
    
    this.dettach();
    
    this.emit('failed', data);
  }
  _newDTMF(data) 
  {
    debug('on newDTMF: %s, tone: %s, duration: %d',
      data.originator, data.dtmf.tone, data.dtmf.duration);
    
    this.emit('newDTMF', data);
  }
  _newInfo(data) 
  {
    debug('on newInfo: %s info: %o', data.originator, data.info);

    this.emit('newInfo', data);
  }
  _hold(data) 
  {
    debug('on hold: %s', data.originator);
    
    this.emit('hold', data);
  }
  _unhold(data) 
  {
    debug('on unhold: %s', data.originator);
        
    this.emit('unhold', data);
  }
  _muted(data) 
  {
    debug('on muted: audio: %s, video: %s', data.audio, data.video);
    
    this.emit('muted', data);
  }
  _unmuted(data) 
  {
    debug('on unmuted: audio: %s, video: %s', data.audio, data.video);

    this.emit('unmuted', data);
  }
  _reinvite(data)
  {
    debug('on reinvite');

    this.emit('reinvite', data);
  }
  _update(data)
  {
    debug('on update');

    this.emit('update', data);
  }
  _refer(data) 
  {
    debug('on refer');

    this.emit('refer', data);
  }
  _replaces(data) 
  {
    debug('on replaces');

    this.emit('replaces', data);
  }
  _sdp(data) 
  {
    debug('on sdp: %s, type: %s', data.originator, data.type);

    if (data.originator === 'local')
    {
      const sdp = SDPTransform.parse(data.sdp);

      for (const m of sdp.media)
      {
        if (m.type === 'video')
        {
          m.content = this.type;
        }
      }
        
      data.sdp = SDPTransform.write(sdp);
    }
    
    this.emit('sdp', data);
  }
  _getusermediafailed(error) 
  {
    debug('on getusermediafailed: %o', error);

    this.emit('getusermediafailed', error);
  }
  _createofferfailed(error) 
  {
    debug('on createofferfailed: %o', error);

    this.emit('createofferfailed', error);
  }
  _createanswerfailed(error) 
  {
    debug('on createanswerfailed: %o', error);

    this.emit('createanswerfailed', error);
  }
  _setlocaldescriptionfailed(error) 
  {
    debug('on setlocaldescriptionfailed: %o', error);

    this.emit('setlocaldescriptionfailed', error);
  }
  _setremotedescriptionfailed(error) 
  {
    debug('on setremotedescriptionfailed: %o', error);
 
    this.emit('setremotedescriptionfailed', error);
  }
};