class StreamStats
{
  constructor() 
  {
    this.lastPackets = 0;
    this.lastLost = 0;
    this.lastBytes = 0;
    this.lastTimestamp = null;
    this.recentTotal = 0;
    this.recentLost = 0;
    this.samples = [];
    this.info = {};
  }

  getStats() 
  {
    return this.info;
  }

  updateBWEStats(result) 
  {
    this.info['configuredBitrate'] = (result.stat('googTargetEncBitrate') / 1000).toFixed(1);
  }

  updatePacketLossStats(currentTotal, currentLost) 
  {
    const self = this;
    let sample;

    if (currentTotal === 0) 
    {
      self.info['packetsLostRateTotal'] = null;
    }
    else 
    {
      self.info['packetsLostRateTotal'] = ((1-(currentLost/(currentTotal + currentLost))) * 100).toFixed(0);
    }

    if (self.samples.length >= 10) 
    {
      sample = self.samples.shift();
      self.recentLost -= sample[0];
      self.recentTotal -= sample[1];
    }
    sample = [ 
      Math.max(currentLost - self.lastLost, 0),
      currentTotal - self.lastPackets
    ];
    self.recentLost += sample[0];
    self.recentTotal += sample[1];
    self.samples.push(sample);

    if (self.recentTotal === 0 ||
        self.recentLost < 0 ||
        self.recentLost > self.recentTotal) 
    {
      self.info['packetsLostRate'] = null;
    }
    else 
    {
      self.info['packetsLostRate'] = (self.recentLost / self.recentTotal * 100).toFixed(0);
    }
  }

  updateRxStats(result) 
  {
    const self = this;

    self.info['packetsReceived'] = result.stat('packetsReceived');
    self.info['packetsLost'] = result.stat('packetsLost');
    self.info['packetsLostRateTotal'] = 0;
    self.info['packetsLostRate'] = 0;
    self.info['availableBandWidth'] = null;

    const packetsReceived = parseInt(self.info['packetsReceived']) | 0;
    const packetsLost = parseInt(self.info['packetsLost']) | 0;

    self.updatePacketLossStats(packetsReceived, packetsLost);

    if (self.lastTimestamp > 0) 
    {
      const kbps = Math.round((result.stat('bytesReceived') - self.lastBytes) * 8 / (result.timestamp - self.lastTimestamp));

      self.info['availableBandWidth'] = kbps > 0 ? kbps : null;
    }

    if (result.stat('googFrameHeightReceived'))
      self.info['resolution'] = {
        width  : result.stat('googFrameWidthReceived'),
        height : result.stat('googFrameHeightReceived')
      };

    if (result.stat('googCodecName'))
      self.info['codeName'] = result.stat('googCodecName');

    if (result.stat('googDecodeMs'))
      self.info['decodeDelay'] = result.stat('googDecodeMs');

    if (result.stat('googJitterBufferMs'))
      self.info['jitterBufferMs'] = result.stat('googJitterBufferMs');

    if (result.stat('googFrameRateReceived'))
      self.info['frameRate'] = result.stat('googFrameRateReceived');

    self.lastTimestamp = result.timestamp;
    self.lastBytes = result.stat('bytesReceived');
    self.lastPackets = packetsReceived;
    self.lastLost = packetsLost;
  }

  updateTxStats(result) 
  {
    const self = this;

    self.info['packetsSent'] = result.stat('packetsSent');
    self.info['packetsLost'] = result.stat('packetsLost');
    self.info['packetsLostRateTotal'] = 0;
    self.info['packetsLostRate'] = 0;
    self.info['availableBandWidth'] = null;

    const packetsSent = parseInt(self.info['packetsSent']) | 0;
    const packetsLost = parseInt(self.info['packetsLost']) | 0;

    self.updatePacketLossStats(packetsSent, packetsLost);

    if (self.lastTimestamp > 0) 
    {
      const kbps = Math.round((result.stat('bytesSent') - self.lastBytes) * 8 / (result.timestamp - self.lastTimestamp));

      self.info['availableBandWidth'] = kbps > 0 ? kbps : null;
    }

    if (result.stat('googFrameHeightSent'))
      self.info['resolution'] = {
        width  : result.stat('googFrameWidthSent'),
        height : result.stat('googFrameHeightSent')
      };

    if (result.stat('googCodecName'))
      self.info['codeName'] = result.stat('googCodecName');

    self.info['jitterBufferMs'] = '0';

    if (result.stat('googFrameRateSent'))
      self.info['frameRate'] = result.stat('googFrameRateSent');

    self.lastTimestamp = result.timestamp;
    self.lastBytes = result.stat('bytesSent');
    self.lastPackets = packetsSent;
    self.lastLost = packetsLost;
  }

  updateRxStatsFF(result) 
  {
    const self = this;

    self.info['packetsReceived'] = `${result.packetsReceived}`; // to String
    self.info['packetsLost'] = String(result.packetsLost); // to String
    self.info['packetsLostRateTotal'] = 0;
    self.info['availableBandWidth'] = null;

    const packetsReceived = parseInt(self.info['packetsReceived']) | 0;
    const packetsLost = parseInt(self.info['packetsLost']) | 0;

    self.updatePacketLossStats(packetsReceived, packetsLost);

    if (self.lastTimestamp > 0) 
    {
      const kbps = Math.round(
        (result.bytesReceived - self.lastBytes) * 8 /
        (result.timestamp - self.lastTimestamp)
      );

      self.info['availableBandWidth'] = kbps > 0 ? kbps : null;
    }

    if (result.jitter)
      self.info['jitterBufferMs'] = result.jitter.toFixed(1);

    if (result.framerateMean)
      self.info['frameRate'] = Math.round(result.framerateMean);

    self.lastTimestamp = result.timestamp;
    self.lastBytes = result.bytesReceived;
    self.lastPackets = packetsReceived;
    self.lastLost = packetsLost;
  }

  updateTxStatsFF(result) 
  {
    const self = this;

    self.info['packetsSent'] = result.packetsSent;
    self.info['availableBandWidth'] = null;
    const packetsSent = parseInt(self.info['packetsSent']) | 0;

    if (self.lastTimestamp > 0) 
    {
      const kbps = Math.round(
        (result.bytesSent - self.lastBytes) * 8 /
        (result.timestamp - self.lastTimestamp)
      );

      self.info['availableBandWidth'] = kbps > 0 ? kbps : null;
    }

    self.info['jitterBufferMs'] = '0';

    if (result.framerateMean)
      self.info['frameRate'] = Math.round(result.framerateMean);

    self.lastTimestamp = result.timestamp;
    self.lastBytes = result.bytesSent;
  }

  updateRtcpTxStatsFF(result) 
  {
    const self = this;

    self.info['packetsLost'] = `${result.packetsLost}`; // to String

    const packetsSent = parseInt(self.info['packetsSent']) | 0;
    const packetsLost = parseInt(self.info['packetsLost']) | 0;

    self.updatePacketLossStats(packetsSent, packetsLost);
    self.lastPackets = packetsSent;
    self.lastLost = packetsLost;
  }
}

class MediaStats 
{

  constructor(parent) 
  {
    this.parent = parent;
    this.audio_out = new StreamStats();
    this.audio_in = new StreamStats();
    this.video_out = new StreamStats();
    this.video_in = new StreamStats();
    this.googCpuLimitedResolution = 'false';
  }

  updateStats(results) 
  {
    const self = this;

    for (let i = 0; i < results.length; ++i) 
    {
      if (self.statIsOfType(results[i], 'audio', 'send')) 
      {
        if (self.parent.isMatchLocalSsrc(results[i].stat('ssrc'))) 
        {
          self.audio_out.updateTxStats(results[i]);
        }
      }
      else if (self.statIsOfType(results[i], 'audio', 'recv')) 
      {
        if (self.parent.isMatchRemoteSsrc(results[i].stat('ssrc'))) 
        {
          self.audio_in.updateRxStats(results[i]);
        }
      }
      else if (self.statIsOfType(results[i], 'video', 'send')) 
      {
        if (self.parent.isMatchLocalSsrc(results[i].stat('ssrc'))) 
        {
          self.video_out.updateTxStats(results[i]);
        }
        self.updateGoogCpuLimitedResolution(results[i]);
      }
      else if (self.statIsOfType(results[i], 'video', 'recv')) 
      {
        if (self.parent.isMatchRemoteSsrc(results[i].stat('ssrc'))) 
        {
          self.video_in.updateRxStats(results[i]);
        }
      }
      else if (self.statIsBandwidthEstimation(results[i])) 
      {
        self.video_out.updateBWEStats(results[i]);
      }
    }
  }

  updateStatsFF(results) 
  {
    const self = this;

    const keys = results.keys();

    for (let key_i = keys.next(); !key_i.done; key_i = keys.next()) 
    {
      const key = key_i.value;

      if (key.indexOf('outbound_rtp_audio') === 0) 
      {
        self.audio_out.updateTxStatsFF(results.get(key));
      }
      else if (key.indexOf('outbound_rtcp_audio') === 0) 
      {
        self.audio_out.updateRtcpTxStatsFF(results.get(key));
      }
      else if (key.indexOf('inbound_rtp_audio') === 0) 
      {
        self.audio_in.updateRxStatsFF(results.get(key));
      }
      else if (key.indexOf('outbound_rtp_video') === 0) 
      {
        self.video_out.updateTxStatsFF(results.get(key));
      }
      else if (key.indexOf('outbound_rtcp_video') === 0) 
      {
        self.video_out.updateRtcpTxStatsFF(results.get(key));
      }
      else if (key.indexOf('inbound_rtp_video') === 0) 
      {
        self.video_in.updateRxStatsFF(results.get(key));
      }
    }
  }

  statIsBandwidthEstimation(result) 
  {
    return result.type == 'VideoBwe';
  }

  statIsOfType(result, type, direction) 
  {
    return result.type == 'ssrc'
            && (result.stat('mediaType') == type || (result.stat('transportId').indexOf(type) != -1)) // Compatible with low version
            && result.id.search(direction) != -1;
  }

  updateGoogCpuLimitedResolution(result) 
  {
    /*
    const self = this;

    const newLimit = result.stat('googCpuLimitedResolution');

    if (newLimit == 'true' && newLimit != self.googCpuLimitedResolution &&
     self.parent.chrome_ver > 55 &&
     self.parent.h264_enabled == true) 
    {
      self.googCpuLimitedResolution = newLimit;
      self.parent.h264_enabled = false;
      self.parent.renegotiate();
    }	
    */
  }

  calcConnectionQuality(result) 
  {
    let totalCount = 2;
    let quality;

    let totalPercent = parseInt(result.audio.send.packetsLostRate) +
     parseInt(result.audio.recv.packetsLostRate);
    // if (videoType === VideoType.CAMERA) {

    totalCount += 2;
    totalPercent += parseInt(result.video.send.packetsLostRate) +
     parseInt(result.video.recv.packetsLostRate);
    // }
    /* // Not currently, can use later
        if (videoType === VideoType.DESKTOP) {
            totalCount + 2;
            totalPercent += result.video.send.packetsLostRate + result.video.recv.packetsLostRate;
        }*/
    const averagePercent = parseInt(totalPercent / totalCount);

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
    
    return quality;
  }

  getStats()
  {
    const self = this;
    const audio_out = self.audio_out.getStats();
    const video_out = self.video_out.getStats();
    const audio_in = self.audio_in.getStats();
    const video_in = self.video_in.getStats();
    const res = {
      'audio' : {
        'send' : audio_out,
        'recv' : audio_in
      },
      'video' : {
        'send' : video_out,
        'recv' : video_in
      }
    };

    return res;
  }
}

module.exports = MediaStats;