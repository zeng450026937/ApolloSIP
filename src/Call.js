const Channel = require('./Channel');
const Utils = require('./Utils');
const Browser = require('bowser');
const Media = require('./Media');
const MediaStats = require('./MediaStats');
const SDPTransform = require('sdp-transform');
const SIP = require('./SIP');
const debug = SIP.debug('Apollo:Call');

module.exports = class Call extends Channel
{
  constructor(ua, target, type, media) 
  {
    super(ua, target, type);
    this._media = media || new Media();
    this._stats = new MediaStats(this);

    this._local_sdp = null;
    this._remote_sdp = null;

    this._local_ssrcs = [];
    this._remote_ssrcs = [];
  }

  get media()
  {
    return this._media;
  }
  set media(media)
  {
    this._media = media;
  }
  get statistics()
  {
    if (!this._session)
    {
      return null;
    }

    const pc = this.connection;

    if (!pc) return;

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
    const pc = this.connection;
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
    const pc = this.connection;
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
      elements.video.srcObject = stream;
    }
    else if (elements.audio) 
    {
      elements.audio.srcObject = stream;
    }
  }

  removeLocalMedia()
  {
    const pc = this.connection;

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
    const pc = this.connection;

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

    if (this.type === Channel.TYPE.SLIDES)
    {
      options.rtcOfferConstraints.offerToReceiveAudio = 0;
      options.rtcOfferConstraints.offerToReceiveVideo = 0;

      options.rtcAnswerConstraints.offerToReceiveAudio = 0;
      options.rtcAnswerConstraints.offerToReceiveVideo = 0;
    }
    
    Object.assign(options, {
      mediaConstraints : this.media.constraints,
      mediaStream      : this.media.stream
    });

    return options;
  }

  _peerconnection(data)
  {
    super._peerconnection(data);

    data.peerconnection.onicecandidate = (event) =>
    {
      const candidate = event.candidate;

      if (candidate)
      {
        debug('peerconnection:onicecandidate: %o', candidate);
      }
    };

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
  }

  _accepted(data)
  {
    super._accepted(data);

    this.setupLocalMedia();
  }

  _sdp(data)
  {
    super._sdp(data);

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

        this._local_ssrcs = this._local_ssrcs.concat(filter);
      }
    }

    if (data.originator === 'remote')
    {
      this._remote_sdp = sdp;

      for (const m of sdp.media)
      {
        filter = m.ssrcs.filter((value) =>
        {
          return value.attribute === 'cname';
        });

        this._remote_ssrcs = this._remote_ssrcs.concat(filter);
      }
    }
  }

  _newInfo(data) 
  {
    super._newInfo(data);

    const info = data.info;

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
    }
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