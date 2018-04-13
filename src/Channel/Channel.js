const EventEmitter = require('events').EventEmitter;
const Error = require('../Error/Error');
const Utils = require('../Base/Utils');
const SIP = require('../Base/SIP');

const debug = SIP.debug('Apollo:Channel');

module.exports = class Channel extends EventEmitter
{
  constructor()
  {
    super();

    this._ua = undefined;
    this._target = undefined;
    this._session = undefined;
    this._options = {};

    this._conferenceId = {};
    this._eventHandlers = {
      'peerconnection'                            : this._peerconnection.bind(this),
      'connecting'                                : this._connecting.bind(this),
      'sending'                                   : this._sending.bind(this),
      'progress'                                  : this._progress.bind(this),
      'accepted'                                  : this._accepted.bind(this),
      'confirmed'                                 : this._confirmed.bind(this),
      'ended'                                     : this._ended.bind(this),
      'finished'                                  : this._finished.bind(this),
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
      'icecandidate'                              : this._icecandidate.bind(this),
      'getusermediafailed'                        : this._getusermediafailed.bind(this),
      'peerconnection:createofferfailed'          : this._createofferfailed.bind(this),
      'peerconnection:createanswerfailed'         : this._createanswerfailed.bind(this),
      'peerconnection:setlocaldescriptionfailed'  : this._setlocaldescriptionfailed.bind(this),
      'peerconnection:setremotedescriptionfailed' : this._setremotedescriptionfailed.bind(this)
    };
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

  get session()
  {
    return this._session;
  }
  set session(session)
  {
    if (this._session !== session)
    {
      Utils.removeEventHandlers(this._session, this._eventHandlers);

      this._session = session;

      Utils.setupEventHandlers(this._session, this._eventHandlers);

      this.emit('sessionChanged', session);
    }
  }

  get options()
  {
    return this._options;
  }
  set options(options)
  {
    if (this._options !== options)
    {
      this._options = options;
      this.emit('optionsChanged', options);
    }
  }

  connect()
  {
    if (this.session)
    {
      this.session.answer();
    }
    else
    {
      // make sure UA & Target
      const options = Object.assign({}, this._fetchOptions(), this.options);
  
      this.session = this.ua.call(this.target, options);
    }
  }

  disconnect()
  {
    if (this.session)
    {
      this.session.terminate();
    }
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

    this.session = null;

    this.emit('ended', new Error.FreeSwitchError(data));
  }
  _finished(data)
  {
    debug('on finished: %s, cause: %s', data.originator, data.cause);

    this.session = null;

    this.emit('finished', new Error.FreeSwitchError(data));
  }
  _failed(data) 
  {
    debug('on failed: %s, cause: %s', data.originator, data.cause);
    
    this.session = null;
    
    this.emit('failed', new Error.FreeSwitchError(data));
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

    const info = data.info;
  
    if (data.originator === 'remote')
    {
      switch (info.contentType) 
      {
        case 'application/apollo-keepalive':
          break;
      }
    }

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
    
    this.emit('sdp', data);
  }
  _icecandidate(data)
  {
    debug('on icecandidate: %o', data.candidate);

    this.emit('icecandidate', data);
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