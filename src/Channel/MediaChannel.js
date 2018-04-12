const Channel = require('./Channel');
const SDPTransform = require('sdp-transform');
const Utils = require('../Base/Utils');
const SIP = require('../Base/SIP');
const Media = require('./Media');
const RTCStats = require('./RTCStats');

const debug = SIP.debug('Apollo:MediaChannel');
const warn = SIP.debug('Apollo:MediaChannel:Warn');

const TYPE = {
  MAIN   : 'main',
  SLIDES : 'slides'
};

module.exports = class MediaChannel extends Channel
{
  static get TYPE()
  {
    return TYPE;
  }

  constructor() 
  {
    super();

    this._type = TYPE.MAIN;
    this._focusUri = undefined;
    this._entity = undefined;
    this._media = new Media();
    this._stats = new RTCStats();

    this._local_sdp = null;
    this._remote_sdp = null;

    this._local_ssrcs = [];
    this._remote_ssrcs = [];

    this._iceTimerOut = null;
  }

  get type()
  {
    return this._type;
  }
  set type(type)
  {
    if (this._type !== type)
    {
      this._type = type;
      this.emit('typeChanged', type);
    }
  }

  get focusUri()
  {
    return this._focusUri;
  }
  set focusUri(focusUri)
  {
    if (this._focusUri !== focusUri)
    {
      this._focusUri = focusUri;
      this.emit('focusUriChanged', focusUri);
    }
  }

  get entity()
  {
    return this._entity;
  }
  set entity(entity)
  {
    if (this._entity !== entity)
    {
      this._entity = entity;
      this.emit('entityChanged', entity);
    }
  }

  get media()
  {
    return this._media;
  }
  set media(media)
  {
    if (this._media !== media)
    {
      this._media = media;
      this.emit('mediaChanged', media);
    }
  }

  get statistics()
  {
    this.getStats();

    return this._stats;
  }

  get localStream()
  {
    const pc = this.session.connection;
    let localStream;

    if (!pc) return localStream;

    if (pc.getSenders) 
    {
      localStream = new global.window.MediaStream();
      pc.getSenders().forEach(function(receiver) 
      {
        const track = receiver.track;

        if (track) 
        {
          localStream.addTrack(track);
        }
      });
    }
    else
    if (pc.getLocalStreams) 
    {
      localStream = pc.getLocalStreams()[0];
    }

    return localStream;
  }
  get remoteStream()
  {
    const pc = this.session.connection;
    let remoteStream;

    if (!pc) return remoteStream;

    if (pc.getReceivers) 
    {
      remoteStream = new global.window.MediaStream();
      pc.getReceivers().forEach(function(receiver) 
      {
        const track = receiver.track;

        if (track) 
        {
          remoteStream.addTrack(track);
        }
      });
    }
    else if (pc.getRemoteStreams) 
    {
      remoteStream = pc.getRemoteStreams()[0];
    }

    return remoteStream;
  }

  getStats()
  {
    if (!this.session)
    {
      return Promise.resolve(this._stats);
    }

    const pc = this.session.connection;

    if (!pc || !pc.getStats || pc.signalingState === 'closed')
    {
      return Promise.resolve(this._stats);
    }

    return pc.getStats()
      .then((stats) =>
      {        
        this._stats.update(stats);

        return Promise.resolve(this._stats);
      });
  }

  setupLocalMedia() 
  {
    const elements = this.media.localElements;
    const stream = this.localStream;

    this.setupElementStream(elements, stream);
  }

  addLocalMedia(stream)
  {
    const pc = this.session.connection;

    if (!pc) return;

    if (pc.addTrack)
    {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }
    else
    if (pc.addStream)
    {
      pc.addStream(stream);
    }
  }

  removeLocalMedia()
  {
    const pc = this.session.connection;

    if (!pc) return;

    if (pc.getSenders) 
    {
      pc.getSenders().forEach(function(sender) 
      {
        if (sender.track) 
        {
          sender.track.stop();
        }
        pc.removeTrack(sender);
      });
    }
    else
    if (pc.getLocalStreams)
    {
      pc.getLocalStreams().forEach(function(stream) 
      {
        stream.getTracks().forEach(function(track) 
        {
          track.stop();
        });
        pc.removeStream(stream);
      });
    }
  }

  setupRemoteMedia() 
  {
    const elements = this.media.remoteElements;
    const stream = this.remoteStream;

    this.setupElementStream(elements, stream);
  }

  removeRemoteMedia() 
  {
    const pc = this.session.connection;

    if (!pc) return;

    if (pc.getReceivers) 
    {
      pc.getReceivers().forEach(function(sender) 
      {
        if (sender.track) 
        {
          sender.track.stop();
        }
        pc.removeTrack(sender);
      });
    }
    else 
    {
      pc.getRemoteStreams().forEach(function(stream) 
      {
        stream.getTracks().forEach(function(track) 
        {
          track.stop();
        });
        pc.removeStream(stream);
      });
    }
  }

  setupElementStream(elements, stream)
  {
    if (elements.video) 
    {
      try 
      {
        elements.video.srcObject = stream;
      }
      catch (error) 
      {
        warn('%o', error);
        elements.video.srcObject = stream;
      }
    }
    else if (elements.audio) 
    {
      try 
      {
        elements.audio.srcObject = stream;
      }
      catch (error) 
      {
        warn('%o', error);
        elements.audio.srcObject = stream; 
      }
    }
  }


  _fetchOptions()
  {
    const options = super._fetchOptions();
    
    options.mediaConstraints = this.media.constraints;
    options.mediaStream = this.media.stream;

    options.rtcOfferConstraints.offerToReceiveAudio = this.media.receiveAudio;
    options.rtcOfferConstraints.offerToReceiveVideo = this.media.receiveVideo;

    options.rtcAnswerConstraints.offerToReceiveAudio = this.media.receiveAudio;
    options.rtcAnswerConstraints.offerToReceiveVideo = this.media.receiveAudio;

    return options;
  }

  _peerconnection(data)
  {
    data.peerconnection.onconnectionstatechange = (event) =>
    {
      debug('peerconnection:onconnectionstatechange : %s', data.peerconnection.connectionState);
    };

    data.peerconnection.oniceconnectionstatechange = (event) =>
    {
      debug('peerconnection:oniceconnectionstatechange: %s', data.peerconnection.iceConnectionState);
    };

    data.peerconnection.onicegatheringstatechange = (event) =>
    {
      debug('peerconnection:onicegatheringstatechange: %s', data.peerconnection.iceGatheringState);
    };

    data.peerconnection.ontrack = () =>
    {
      debug('peerconnection:ontrack');
      this.setupRemoteMedia();
    };

    /*
    data.peerconnection.onaddstream = () =>
    {
      debug('peerconnection:onaddstream');
      this.setupRemoteMedia();
    };
    */

    data.peerconnection.onremovestream = () =>
    {
      debug('peerconnection:onremovestream');
      this.setupRemoteMedia();
    };

    /*
    const datachannel = data.peerconnection.createDataChannel('chat');

    datachannel.onerror = (error) => 
    {
      debug('Data Channel Error: %o', error);
    };

    datachannel.onmessage = (event) => 
    {
      debug('Data Channel Message: ', event.data);
    };

    datachannel.onopen = () => 
    {
      debug('Data Channel Opened');
    };

    datachannel.onclose = () => 
    {
      debug('Data Channel Closed');
    };
    */
    
    super._peerconnection(data);
  }

  _accepted(data)
  {
    const response = data.response;

    if (response.hasHeader('apollo-focus-uri')) 
    {
      const focusUri = response.getHeader('apollo-focus-uri');

      this.focusUri = SIP.Grammar.parse(focusUri, 'Contact')[0].parsed.uri.toString();
    }
    if (response.hasHeader('Apollo-Conference-Entity')) 
    {
      this.entity = response.getHeader('Apollo-Conference-Entity');
    }

    this.setupLocalMedia();

    super._accepted(data);
  }

  _ended(data)
  {
    this._clear();
    super._ended(data);
  }

  _failed(data)
  {
    this._clear();
    super._failed(data);
  }

  _clear()
  {
    let elements = this.media.localElements;

    this.setupElementStream(elements, null);

    elements = this.media.remoteElements;

    this.setupElementStream(elements, null);

    this._stats.clear();
  }

  _sdp(data)
  {
    const sdp = SDPTransform.parse(data.sdp);

    // Make sure sdp.media is an array, not the case if there is only one media.
    if (! Array.isArray(sdp.media))
    {
      sdp.media = [ sdp.media ];
    }

    debug('sdp: %o', sdp);

    let filter;

    if (data.originator === 'local')
    {
      this._local_sdp = sdp;
      this._local_ssrcs = [];

      for (const m of sdp.media)
      {
        if (m.type === 'video')
        {
          m.content = this.type;
        }

        if (!m.ssrcs)
        {
          continue;
        }
        
        filter = m.ssrcs.filter((value) =>
        {
          return value.attribute === 'cname';
        });

        this._local_ssrcs = this._local_ssrcs.concat(filter);
      }
    }

    if (data.originator === 'remote')
    {
      this._remote_sdp = sdp;
      this._remote_ssrcs = [];

      for (const m of sdp.media)
      {
        if (!m.ssrcs)
        {
          continue;
        }

        filter = m.ssrcs.filter((value) =>
        {
          return value.attribute === 'cname';
        });

        this._remote_ssrcs = this._remote_ssrcs.concat(filter);
      }
    }

    data.sdp = SDPTransform.write(sdp);

    super._sdp(data);
  }

  _icecandidate(data)
  {
    // data.candidate
    // RTCIceCandidate instance as described in the W3C specification.

    // data.ready
    // Function to be executed by the event callback if candidate is
    // the last one to be gathered prior to retrieve the local description.
    if (this._iceTimerOut)
    {
      clearTimeout(this._iceTimerOut);
      this._iceTimerOut = null;
    }

    this._iceTimerOut = setTimeout(() =>
    {
      debug('ICE gathering timeout.');
      data.ready();
    }, 2000);

    super._icecandidate(data);
  }

  _newInfo(data) 
  {
    const info = data.info;

    if (data.originator === 'remote')
    {
      switch (info.contentType) 
      {
        case 'application/apollo-media-control+xml':
          {
            const body = Utils.objectify(info.body);

            if (body && body['media_control']['yms_re_negotiation']) 
            {
              let media = body['media_control']['yms_re_negotiation']['media'];
              const constraints = { };

              if (!Array.isArray(media))
                media = [ media ];

              media.forEach((m) => 
              {
                if (m['@type'] === 'video') 
                {
                  constraints.video = {
                    width  : { exact: Number.parseInt(m['@width']) },
                    height : { exact: Number.parseInt(m['@height']) }
                  };
                }
              });
            }
          }
          break;
        case 'application/apollo-keepalive':
          // nothing to do
          break;
      }
    }

    super._newInfo(data);
  }

  isMatchLocalSsrc(ssrcId)
  {
    for (const ssrc of this._local_ssrcs) 
    {
      if (ssrcId == ssrc.id) 
      {
        return true;
      }
    }
    
    return false;
  }
  isMatchRemoteSsrc(ssrcId)
  {
    for (const ssrc of this._remote_ssrcs) 
    {
      if (ssrcId == ssrc.id) 
      {
        return true;
      }
    }
    
    return false;  
  }
};