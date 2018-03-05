const debug = require('../Base/Debug')('Apollo:Media');

module.exports = class Media
{
  constructor() 
  {
    this._elements = {
      remote : {
        video : null,
        audio : null
      },
      local : {
        video : null,
        audio : null
      }
    };

    this._constraints = {
      audio : {
        deviceId : {
          ideal : 'default'
        },
        groupId          : '',
        autoGainControl  : true,
        channelCount     : 2,
        echoCancellation : true,
        latency          : 3.0,
        noiseSuppression : true,
        sampleRate       : 48000,
        sampleSize       : 32,
        volume           : 1.0
      },
      video : {
        deviceId : {
          ideal : 'default'
        },
        groupId     : '',
        aspectRatio : {
          ideal : 16/9,
          min   : 4/3,
          max   : 16/9
        },
        facingMode : {
          ideal : 'user' // user|environment|left|right
        },
        frameRate : {
          ideal : 30,
          min   : 20,
          max   : 60
        },
        height : {
          ideal : 720,
          min   : 480,
          max   : 1080
        },
        width : {
          ideal : 1280,
          min   : 640,
          max   : 1920
        }
      }
    };

    this._stream = null;

    this._remote = {
      audio : true,
      video : true
    };
  }

  get audioConstraints() 
  {
    return Object.assign({}, this._constraints.audio);
  }
  set audioConstraints(constraints = {}) 
  {
    debug('set audioConstraints()');

    if (typeof constraints === 'object')
    {
      this._constraints.audio = Object.assign({}, constraints);
    }
    else
    {
      this._constraints.audio = constraints;
    }
  }
  get videoConstraints() 
  {
    return Object.assign({}, this._constraints.video);
  }
  set videoConstraints(constraints = {}) 
  {
    debug('set videoConstraints()');
    
    if (typeof constraints === 'object')
    {
      this._constraints.video = Object.assign({}, constraints);
    }
    else
    {
      this._constraints.video = constraints;
    }
  }
  get constraints()
  {
    return Object.assign({}, this._constraints);
  }
  set constraints(constraints = {})
  {
    this._constraints = Object.assign({}, constraints);
  }
  get receiveAudio()
  {
    return this._remote.audio;
  }
  set receiveAudio(receive)
  {
    this._remote.audio = receive;
  }
  get receiveVideo()
  {
    return this._remote.video;
  }
  set receiveVideo(receive)
  {
    this._remote.video = receive;
  }

  get stream()
  {
    return this._stream;
  }
  set stream(stream)
  {
    this._stream = stream;
  }

  get localElements() 
  {
    return Object.assign({}, this._elements.local);
  }
  set localElements(local = {}) 
  {
    this._elements.local = Object.assign({}, local);

    if (local.audio) 
    {
      this._setupElement(local.audio);
    }
    if (local.video) 
    {
      local.video.muted = true;
      this._setupElement(local.video);
    }
  }

  get remoteElements() 
  {
    return Object.assign({}, this._elements.remote);
  }
  set remoteElements(remote = {}) 
  {
    this._elements.remote = Object.assign({}, remote);

    if (remote.audio) 
    {
      this._setupElement(remote.audio);
    }
    if (remote.video) 
    {
      this._setupElement(remote.video);
    }
  }

  get elements()
  {
    return Object.assign({}, this._elements);
  }
  set elements(elements = {})
  {
    this._elements = Object.assign({}, elements);
  }

  _setupElement(element) 
  {
    if (element.remote) 
    {
      element.autoplay = true;
      element.onloadedmetadata = () => 
      {
        element.play().catch(() => 
        {
          debug('play was rejected.');
        });
      };
    }
  }
};