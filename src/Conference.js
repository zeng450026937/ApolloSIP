const Channel = require('./Channel');
const Call = require('./Call');
const ConferenceInfo = require('./ConferenceInfo');
const Command = require('./Command');
const Utils = require('./Utils');
const SIP = require('./SIP');
const debug = require('./SIP').debug('Apollo:Conference');

const C = {
  GET_CONFERENCE               : 'getConference',
  GET_BOOK_CONFERENCE_TEMPLATE : 'getBookConferenceTemplate',
  MODIFY_CONFERENCE            : 'modifyConference',
  MODIFY_CONFERNCE_LOCK        : 'modifyConferenceLock',
  ADD_USER                     : 'addUser',
  DELETE_USER                  : 'deleteUser',
  MODIFY_USER_ROLES            : 'modifyUserRoles',
  MODIFY_ENDPOINT_MEDIA        : 'modifyEndpointMedia',
  MODIFY_ENDPOINT_MEDIA_BATCH  : 'modifyEndpointMediaBatch,',
  SET_LOBBY_ACCESS             : 'setLobbyAccess',
  SET_DEMONSTRATOR             : 'setDemonstrator',
  SET_TITLE                    : 'setTitle',
  CANCEL_TITLE                 : 'cancelTitle',
  ADD_RTMP_USER_BATCH          : 'addRtmpUserBatch',
  MODIFY_RTMP_ENDPOINT_MEDIA   : 'modifyRtmpEpMedia',
  HOLD_RTMP_USER               : 'holdRtmpUser',
  RESUME_RTMP_USER             : 'resumeRtmpUser',

  LobbyAccess : {
    GRANTED : 'granted',
    DENIED  : 'denied'
  },
  UserRole : {
    OGANIZER  : 'organizer',
    ATTENDEE  : 'attendee',
    PRESENTER : 'presenter'
  },
  DemoSTATUS : {
    ON  : 'OnDemo',
    OFF : 'OffDemo'
  },
  Layout : {
    EQUALITY          : 'Equality',
    SPEECH_EXCITATION : 'SpeechExcitation',
    EXCLUSIVE         : 'Exclusive'
  },
  AdmissionPolicy : {
    CLOSE     : 'closedAuthenticated',
    OPEN      : 'openAuthenticated',
    ANONYMOUS : 'anonymous'
  }
};

module.exports = class Conference extends Channel
{
  constructor(ua, target, entity)
  {
    super(ua, target);

    this._conferenceId = {
      entity   : entity,
      focusUri : target
    };
    
    this._entity = entity;
    this._focusUri = target;

    this._from = ua.get('uri').toString();
    this._to = entity;
    this._user = null;

    this._uris = {
      focus : this._focusUri,
      av    : undefined,
      chat  : undefined,
      share : undefined
    };
    this._channels = {
      focus : this,
      av    : undefined,
      chat  : undefined,
      share : undefined
    };

    this._info = new ConferenceInfo(this);

    this._subscription = null;
  }

  get entity()
  {
    return this._entity;
  }
  get info()
  {
    return this._info;
  }

  get avChannel()
  {
    return this._channels.av;
  }
  set avChannel(channel)
  {
    this._channels.av = channel;
  }
  get chatChannel()
  {
    return this._channels.chat;
  }
  set chatChannel(channel)
  {
    this._channels.chat = channel;
  }
  get shareChannel()
  {
    return this._channels.share;
  }
  set shareChannel(channel)
  {
    this._channels.share = channel;
  }

  get statistics()
  {
    let report;

    if (this.avChannel.isAvariable() && this.avChannel.isEstablished())
    {
      report= this.avChannel.statistics;
    }

    if (this.shareChannel.isAvariable() && this.shareChannel.isEstablished())
    {
      report.screen = this.shareChannel.statistics.video;
      report.screen.sender = report.screen.send.packetsSent?true:false;
    }

    return report;
  }

  connect(options = {})
  {
    debug('connect()');

    if (this.isAvariable() && (this.isInProgress() || this.isEstablished()))
    {
      return;
    }

    const requestId = SIP.Utils.createRandomToken(10, 10);
    const body = {};

    body[C.ADD_USER] = {
      'conferenceKeys' : {
        '@confEntity' : this._to
      },
      'user' : {
        '@requestUri' : this._from
      }
    };

    const xml = Command.Make(this._from, this._to, requestId, body);

    Object.assign(options, {
      contentType : 'application/conference-ctrl+xml',
      body        : xml,
      withoutSDP  : true
    });

    super.connect(options);
  }

  terminate(options)
  {
    super.terminate(options);
  }

  getConference() 
  {
    const body = {};

    body[C.GET_CONFERENCE] = {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      }
    };

    return this._deferSend(body);
  }

  getConferenceTemplate() 
  {
    const body = {};

    body[C.GET_BOOK_CONFERENCE_TEMPLATE] = {
      'conference-info' : {
        '@entity' : this._entity
      }
    };

    return this._deferSend(body);
  }

  // modify conference layout
  modifyConference(layout) 
  {
    const conferenceInfo = {
      '@entity'         : this._entity,
      '@state'          : 'partial',
      'conference-view' : {
        'entity-view' : {
          '@entity'      : this._uris.av,
          '@state'       : 'partial',
          'entity-state' : {
            'video-layout'   : layout,
            'video-max-view' : 5
          }
        }
      }
    };

    const body = {};

    body[C.GET_CONFERENCE_STATISTICS] = {
      'conference-info' : conferenceInfo
    };

    return this._deferSend(body);
  }

  modifyConferenceLock(lock, admissionPolicy) 
  {
    const body = {};

    body[C.GET_CONFERENCE_STATISTICS] = {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      },
      'locked'           : lock,
      'admission-policy' : admissionPolicy
    };

    this._deferSend(body);
  }

  addUser(uri) 
  {
    const body = {};
    const user = [];

    if (Array.isArray(uri)) 
    {
      for (const value of uri) 
      {
        user.push({
          '@requestUri' : value
        });
      }
    }
    else 
    {
      user.push({
        '@requestUri' : uri
      });
    }

    body[C.ADD_USER] = {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      },
      'user' : user
    };

    return this._deferSend(body);
  }

  deleteUser(entity) 
  {
    const body = {};

    body[C.DELETE_USER] = {
      'userKeys' : {
        '@confEntity' : this._entity,
        '@userEntity' : entity
      }
    };

    return this._deferSend(body);
  }

  modifyUserRole(entity, role) 
  {
    const body = {};

    body[C.MODIFY_USER_ROLES] = {
      'userKeys' : {
        '@confEntity' : this._entity,
        '@userEntity' : entity
      },
      'user-roles' : {
        'entry' : role
      }
    };

    return this._deferSend(body);
  }

  modifyEndpointMedia(entity, enable) 
  {
    const body = {};

    const user = this.info.findUser(this._from);

    if (!user)
    {
      throw new Error('Missing User');
    }

    let endpoint = user['endpoint'];

    if (!endpoint)
    {
      throw new Error('Missing Endpoint');
    }

    endpoint = Utils.arrayfy(endpoint);
    
    const avEndpoint = endpoint.find((e) =>
    {
      return e['@session-type'] == 'audio-video';
    });

    if (!avEndpoint)
    {
      throw new Error('Missing AV Endpoint');
    }

    let media = avEndpoint['media'];

    if (!media)
    {
      throw new Error('Missing Media');
    }

    media = Utils.arrayfy(media);

    const audio = media.find((m) =>
    {
      return m['type'] == 'audio';
    });

    const video = media.find((m) =>
    {
      return m['type'] == 'video';
    });

    body[C.MODIFY_ENDPOINT_MEDIA] = {
      '@mcuUri'   : this._uris.av,
      'mediaKeys' : {
        '@confEntity'     : this._entity,
        '@userEntity'     : entity,
        '@endpointEntity' : avEndpoint['@entity'],
        '@mediaId'        : audio['@id']
      },
      'media' : {
        '@id'                  : audio['@id'],
        'type'                 : audio['type'],
        'status'               : enable?'sendrecv':'recvonly',
        'media-ingress-filter' : enable?'unblock':'block'
      }
    };

    return this._deferSend(body);
  }

  modifyEndpointMediaBatch(entityArray, options) 
  {

  }

  setLobbyAccess(entity, enable) 
  {
    const body = {};
    const userEntity = [];

    if (!Array.isArray(entity)) 
    {
      entity = [ entity ];
    }

    for (const value of entity) 
    {
      userEntity.push({
        '#text' : value
      });
    }

    body[C.SET_LOBBY_ACCESS] = {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      },
      'userEntity' : userEntity,
      'access'     : enable?C.LobbyAccess.GRANTED:C.LobbyAccess.DENIED
    };

    return this._deferSend(body);
  }

  setDemonstrator(entity, enable) 
  {
    const body = {};
    const userEntity = [];

    if (Array.isArray(entity)) 
    {
      for (const value of entity) 
      {
        userEntity.push({
          '#text' : value
        });
      }
    }
    else 
    {
      userEntity.push({
        '#text' : entity
      });
    }

    body[C.SET_LOBBY_ACCESS] = {
      'conferenceKeys' : {
        '@confEntity' : this.entity
      },
      'userEntity' : userEntity,
      'demoState'  : enable?C.DemoState.ON:C.DemoState.OFF
    };

    return this._deferSend(body);
  }

  setTitle(title) 
  {
    const skeleton = {
      type           : 'Static', // Static|Dynamic
      repeatCount    : 3,
      repeatInterval : 5,
      displayTime    : 5,
      displayText    : 'title',
      position       : 'top', // top|medium|bottom
      rollDirection  : 'R2L' // R2L|L2R
    };

    for (const attr in title) 
    {
      if (title[attr] !== undefined) 
      {
        skeleton[attr] = title[attr];
      }
    }

    const body = {};

    body[C.SET_TITLE] = title;

    Object.assign(body[C.SET_TITLE], {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      }
    });

    return this._deferSend(body);
  }

  cancelTitle() 
  {
    const body = {};

    body[C.CANCEL_TITLE] = {};

    Object.assign(body[C.SET_TITLE], {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      }
    });

    return this._deferSend(body);
  }

  addRtmpUserBatch() 
  {
    const rtmpUser = [];
    const body = {};

    body[C.ADD_RTMP_USER_BATCH] = {};

    Object.assign(body[C.ADD_RTMP_USER_BATCH], {
      'conferenceKeys' : {
        '@confEntity' : this._entity
      },
      'rtmp-user' : rtmpUser
    });

    return this._deferSend(body);
  }

  modifyRtmpEndpointMedia(entity, endpoint) 
  {
    const body = {};

    body[C.MODIFY_RTMP_ENDPOINT_MEDIA] = {};

    Object.assign(body[C.MODIFY_RTMP_ENDPOINT_MEDIA], {
      'userKeys' : {
        '@confEntity' : this._entity,
        '@userEntity' : entity
      },
      'endpoint' : endpoint
    });

    return this._deferSend(body);
  }

  holdRtmpUser(entity) 
  {
    const body = {};

    body[C.HOLD_RTMP_USER] = {};

    Object.assign(body[C.HOLD_RTMP_USER], {
      'userKeys' : {
        '@confEntity' : this._entity,
        '@userEntity' : entity
      }
    });

    return this._deferSend(body);
  }

  resumeRtmpUser(entity) 
  {
    const body = {};

    body[C.RESUME_RTMP_USER] = {};

    Object.assign(body[C.RESUME_RTMP_USER], {
      'userKeys' : {
        '@confEntity' : this._entity,
        '@userEntity' : entity
      }
    });

    return this._deferSend(body);
  }

  _newInfo(data)
  {
    super._newInfo(data);

    const info = data.info;

    if (data.originator === 'remote')
    {
      switch (info.contentType) 
      {
        case 'application/apollo-keepalive':
          break;
      }
    }
  }

  _newNotify(data)
  {
    const notify = Utils.objectify(data.notify);

    if (notify)
    {
      this._info.update(notify);

      this.emit('notify', notify);
    }
  }

  _accepted(data)
  {
    super._accepted(data);

    let response = data.response;

    if (!response.body)
    {
      data.cause = 'Missing Body';
      this._failed(data);
      this.terminate();
    }

    response = Command.Parse(response.body);

    if (!response)
    {
      data.cause = 'Parse Response Failed';
      this._failed(data);
      this.terminate();
    }

    debug('focus response: %o', response);

    const addUser = response[C.ADD_USER];

    this._user = addUser['user'];
    this._from = this._user['@entity'];

    this._subscribe();
  }

  _ended(data)
  {
    super._ended(data);

    if (this._subscription)
    {
      this._subscription.terminate();
    }
  }

  _failed(data)
  {
    super._failed(data);
  }

  _subscribe()
  {
    const event = 'conference';
    const expires = 3600;
    const extraHeaders = [
      'Accept: application/conference-info+xml'
    ];

    this._subscription = this._ua.subscribe(this._focusUri, event, {
      expires       : expires,
      extraHeaders  : extraHeaders,
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
          this._newNotify(data);
        }
      }
    });

    this._subscription.once('notify', (data) =>
    {
      const notify = Utils.objectify(data.notify);

      if (notify)
      {
        this._info.update(notify);
        this._uris = this._info.uris;

        if (!this.avChannel && this._uris.av)
        {
          this.avChannel = new Call(this._ua, this._uris.av, Call.TYPE.MAIN);
        }
        if (!this.chatChannel && this._uris.chat)
        {
          this.chatChannel = new Call(this._ua, this._uris.chat, Call.TYPE.SLIDES);
        }
        if (!this.shareChannel && this._uris.share)
        {
          this.shareChannel = new Call(this._ua, this._uris.share, Call.TYPE.SLIDES);
        }
      }
    });
  }

  _deferSend(body) 
  {
    if (!this.isEstablished())
    {
      return Promise.reject(new SIP.Exceptions.InvalidStateError(this._status));
    }

    const defer = Utils.defer();
    const requestId = SIP.Utils.createRandomToken(10, 10);
    const xml = Command.Make(this._from, this._to, requestId, body);
    const options = {
      eventHandlers : {
        succeeded : (data) =>
        {
          debug('info succeeded: %s', data.originator);
    
          const response = Command.Parse(data.response.body);
    
          if (!response) 
          {
            data.cause = 'Missing Content';
            defer.reject(data);
    
            return;
          }
    
          for (const attr in response) 
          {
            if (!(/^@/.test(attr))) 
            {
              debug('info command: %s', attr);
              debug('info result: %o', response[attr]);
              defer.resolve(response[attr]);
            }
          }
        },
        failed : (data) =>
        {
          data.cause = SIP.C.causes.SIP_FAILURE_CODE;
          defer.reject(data);
        }
      }
    };
    const contentType = 'application/conference-ctrl+xml';
    
    this.sendInfo(contentType, xml, options);

    return defer.promise;
  }
};