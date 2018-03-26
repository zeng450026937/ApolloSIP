const Channel = require('./Channel');
const Browser = require('bowser');
const SDPTransform = require('sdp-transform');
const Utils = require('../Base/Utils');
const SIP = require('../Base/SIP');
const Media = require('./Media');
const MediaStats = require('./MediaStats');

const debug = SIP.debug('Apollo:MediaChannel');

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
    this._stats = new MediaStats(this);

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
    if (!this._session)
    {
      return null;
    }

    const pc = this.session.connection;

    if (!pc) return null;

    if (pc.signalingState !== 'closed') 
    {
      if (pc && pc.getStats) 
      {
        if (Browser.chrome || Browser.opera) 
        {
          pc.getStats((rawStats) =>
          {
            this._stats.updateStats(rawStats.result());                    
          });
        }
        else if (Browser.firefox && Browser.version > 47) 
        {
          pc.getStats(null).then((rawStats) =>
          {
            this._stats.updateStatsFF(rawStats);
          });
        }
      }
    }

    const stats = this._stats.getStats();

    calcCallQuality.call(this, stats);
    calcAvailableBandWidth.call(this, stats);

    function calcCallQuality(report)
    {
      const audio_out = report.audio.send;
      const audio_in = report.audio.recv;
      const video_out = report.video.send;
      const video_in = report.video.recv;
      const hasVideoTaking = this.media.videoConstraints!== false? true:false;
      let totalCount = 2, hasAudio = false;
      let averagePercent = 0, quality = -1;
      let totalPercent, screenPacketsLostRate;
  
      if ((!Utils.isUndefined(audio_out.packetsLostRate)) 
          && !Utils.isUndefined(audio_in.packetsLostRate)) 
      {
        totalPercent = parseInt(audio_out.packetsLostRate) +
         parseInt(audio_in.packetsLostRate);
        hasAudio = true;
      }
      if (hasVideoTaking) 
      { // may be we need to determine if the camera is abnormal
        if ((!Utils.isUndefined(video_out.packetsLostRate))
              && !Utils.isUndefined(video_in.packetsLostRate)) 
        {
          totalCount += 2;
          totalPercent += parseInt(video_out.packetsLostRate) +
           parseInt(video_in.packetsLostRate);        
        }
      }

      if (totalCount == 2 && hasAudio === false) 
      { // no data
        return -1;
      }
      averagePercent = parseInt(totalPercent / totalCount);
      if (averagePercent >= 12) 
      {
        quality = 0;
      }
      else if (averagePercent >= 5) 
      {
        quality = 1;
      }
      else if (averagePercent >= 3) 
      {
        quality = 2;
      }
      else if (averagePercent >= 2) 
      {
        quality = 3;
      }
      else 
      {
        quality = 4;
      }
  
      report.callQuality = quality;

      return quality;  
    }

    function calcAvailableBandWidth(report)
    {
      const audio_out = report.audio.send;
      const audio_in = report.audio.recv;
      const video_out = report.video.send;
      const video_in = report.video.recv;
  
      if (!Utils.isUndefined(audio_out['availableBandWidth']) 
          && !Utils.isUndefined(video_out['availableBandWidth'])) 
      {
        report.sendBandWidth = Math.round(audio_out['availableBandWidth'] + video_out['availableBandWidth']);
      }
      else if (!Utils.isUndefined(audio_out['availableBandWidth'])) 
      {
        report.sendBandWidth = Math.round(audio_out['availableBandWidth']);
      }
      else if (!Utils.isUndefined(video_out['availableBandWidth'])) 
      {
        report.sendBandWidth = Math.round(video_out['availableBandWidth']);
      }
      
      if (!Utils.isUndefined(audio_in['availableBandWidth']) 
          && !Utils.isUndefined(video_in['availableBandWidth'])) 
      {
        report.recvBandWidth = parseFloat(audio_in['availableBandWidth']) + parseFloat(video_in['availableBandWidth']);
      }
      else if (!Utils.isUndefined(audio_in['availableBandWidth'])) 
      {
        report.recvBandWidth = Math.round(audio_in['availableBandWidth']);
      }
      else if (!Utils.isUndefined(video_in['availableBandWidth'])) 
      {
        report.recvBandWidth = Math.round(video_in['availableBandWidth']);
      }  
    }

    return stats;
  }

  get localStream()
  {
    const pc = this.session.connection;
    let localStream;

    if (!pc) return localStream;

    if (pc.getLocalStreams) 
    {
      localStream = pc.getLocalStreams();

      for (const stream of localStream) 
      {
        debug('Local streams: %o', stream);
        stream.getTracks().forEach((track) => debug('Local Tracks: %o', track));
      }
      localStream = pc.getLocalStreams()[0];
    }
    else if (pc.getSenders) 
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
    {
      debug('No Remote streams');
    }

    return localStream;
  }
  get remoteStream()
  {
    const pc = this.session.connection;
    let remoteStream;

    if (!pc) return remoteStream;

    if (pc.getRemoteStreams) 
    {
      remoteStream = pc.getRemoteStreams();

      for (const stream of remoteStream) 
      {
        debug('Remote streams: %o', stream);
        stream.getTracks().forEach((track) => debug('Remote Tracks: %o', track));
      }
      remoteStream = pc.getRemoteStreams()[0];
    }
    else if (pc.getReceivers) 
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
    else 
    {
      debug('No Remote streams');
    }

    return remoteStream;
  }

  setupLocalMedia() 
  {
    const elements = this.media.localElements;
    const stream = this.localStream;

    if (elements.video) 
    {
      elements.video.srcObject = null;
      elements.video.srcObject = stream;
    }
    else if (elements.audio) 
    {
      elements.audio.srcObject = null;
      elements.audio.srcObject = stream;
    }
  }

  addLocalMedia(stream)
  {
    const pc = this.session.connection;

    if (!pc) return;

    if (pc.addStream)
    {
      pc.addStream(stream);
    }
    else
    {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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

    if (elements.video) 
    {
      elements.video.srcObject = stream;
    }
    else if (elements.audio) 
    {
      elements.audio.srcObject = stream;
    }
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

    data.peerconnection.onaddstream = () =>
    {
      debug('peerconnection:onaddstream');
      this.setupRemoteMedia();
    };

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
    }
    else
    {
      this._iceTimerOut = setTimeout(() =>
      {
        data.ready();
      }, 1500);
    }

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