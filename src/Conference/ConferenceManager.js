const Manager = require('../Manager/Manager');
const Conference = require('./Conference');
const Command = require('../Command/Command');
const Utils = require('../Base/Utils');
const SIP = require('../Base/SIP');
const debug = SIP.debug('Apollo:ConferenceManager');

const C = {
  ADD_CONFERENCE                    : 'addConference',
  DELETE_CONFERENCE                 : 'deleteConference',
  ADD_VMR                           : 'addVMR',
  BOOK_CONFERENCE                   : 'bookConference',
  GET_CONFERENCE                    : 'getConference',
  GET_CONFERENCE_BY_NUM             : 'getConferenceByConfNumber',
  GET_CONFERENCE_STATISTICS         : 'getConferencesStatistics',
  GET_BOOK_CONFERENCE_SCHEDULE      : 'getBookConferenceSchedule',
  GET_BOOK_CONFERENCE_POINT_RUNNING : 'getBookConferencePointRunning',
  GET_BOOK_CONFERENCE_TEMPLATE      : 'getBookConferenceTemplate'
};

module.exports = class ConferenceManager extends Manager
{
  constructor() 
  {
    super();

    this._from = undefined;
    this._factoryUri = undefined;

    this.on('uaChanged', (ua) => 
    {
      this.from = ua.get('uri');
      this.factoryUri = ua.get('conferenceFactoryUri');
    });
  }

  get from()
  {
    return this._from;
  }
  set from(from)
  {
    if (this._from !== from)
    {
      this._from = from;
      this.emit('fromChanged', from);
    }
  }

  get factoryUri()
  {
    return this._factoryUri;
  }
  set factoryUri(factoryUri)
  {
    if (this._factoryUri !== factoryUri)
    {
      this._factoryUri = factoryUri;
      this.emit('factoryUriChanged', factoryUri);
    }
  }

  isAvariable()
  {
    return super.isAvariable() && this.factoryUri;
  }

  createConference(conferenceInfo) 
  {
    return this.addConference(conferenceInfo)
      .catch((e) => 
      {
        debug('add conference failed. error: %o', e);
        throw e;
      })
      .then((xml) => 
      {
        const conference = new Conference();
        const information = Conference.parseInformation(xml);

        conference.ua = this.ua;
        conference.entity = information.entity;

        let uris = information.description.confUris;

        uris = Utils.arrayfy(uris['entry']);

        uris.forEach(function(entry)
        {
          const { purpose, uri } = entry;

          switch (purpose) 
          {
            case 'focus':
              conference.focusChannel.target = uri;
              break;
            case 'audio-video':
              conference.mediaChannel.target = uri;
              break;
            case 'applicationsharing':
              conference.shareChannel.target = uri;
              break;
          }
        });  

        return Promise.resolve(conference);
      });
  }

  addConference(conferenceInfo) 
  {
    const body = {};
    const defaultInfo = {
      '@entity'                : '',
      'conference-description' : {
        'organizer' : {
          'username' : this.from._user,
          'realm'    : this.from._host
        },
        'subject' : 'Conference',
        'profile' : 'default' // default | demonstrator
      },
      'conference-view' : {
        'entity-view ' : [
          { '@entity': 'audio-video' },
          { '@entity': 'chat' },
          { '@entity': 'applicationsharing' }
        ]
      }
    };

    conferenceInfo = conferenceInfo || defaultInfo;

    body[C.ADD_CONFERENCE] = {
      'conference-info' : conferenceInfo
    };

    return this._deferSend(body);
  }

  deleteConference(conferenceEntity) 
  {
    const body = {};

    body[C.DELETE_CONFERENCE] = {
      'conferenceKeys' : {
        '@entity' : conferenceEntity
      }
    };

    return this._deferSend(body);
  }

  addVMR(conferenceInfo) 
  {
    const body = {};

    body[C.ADD_VMR] = {
      'conference-info' : conferenceInfo
    };

    return this._deferSend(body);
  }

  getConferenceStatistics() 
  {
    const body = {};

    body[C.GET_CONFERENCE_STATISTICS] = {};

    return this._deferSend(body);
  }

  getConferenceByNumber(conferenceNumber) 
  {
    const body = {};

    body[C.GET_CONFERENCE_BY_NUM] = {
      'conferenceKeys' : {
        '@confNumber' : conferenceNumber
      }
    };

    return this._deferSend(body);
  }

  bookConference(conferenceInfo) 
  {
    const body = {};

    body[C.BOOK_CONFERENCE] = {
      'conference-info' : conferenceInfo
    };

    return this._deferSend(body);
  }

  cancelConference(conferenceEntity) 
  {
    const body = {};

    body[C.BOOK_CONFERENCE] = {
      'conference-info' : {
        '@entity' : conferenceEntity,
        '@state'  : 'deleted'
      }
    };

    return this._deferSend(body);
  }

  getConferenceSchedule(startDateTime, endDateTime) 
  {
    const body = {};

    body[C.GET_BOOK_CONFERENCE_SCHEDULE] = {
      'startDateTime' : Utils.formatDate(startDateTime),
      'endDateTime'   : Utils.formatDate(endDateTime)
    };

    return this._deferSend(body);
  }

  getRunningConference(dateTime) 
  {
    dateTime = dateTime || new Date();

    const body = {};

    body[C.GET_BOOK_CONFERENCE_POINT_RUNNING] = {
      'DateTime' : Utils.formatDate(dateTime)
    };

    return this._deferSend(body);
  }

  getConferenceTemplate(conferenceEntity) 
  {
    if (!conferenceEntity || conferenceEntity === '') 
    {
      return Promise.reject('Conference entity is required.');
    }
    const body = {};

    body[C.GET_BOOK_CONFERENCE_TEMPLATE] = {
      'conference-info' : {
        '@entity' : conferenceEntity
      }
    };

    return this._deferSend(body);
  }

  _deferSend(body) 
  {
    const defer = Utils.defer();
    const requestId = SIP.Utils.createRandomToken(10, 10);
    const from = `${this.from._host}\\${this.from._user}`;
    const to = this.factoryUri;
    const xml = Command.Make(from, to, requestId, body);
    const event = 'conference';
    const contentType = 'application/conference-ctrl+xml';
    const options = {
      contentType   : contentType,
      eventHandlers : {
        'succeeded' : (data) =>
        {
          debug('service succeeded: %s', data.originator);

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
              debug('service command: %s', attr);
              debug('service result: %o', response[attr]);
              defer.resolve(response[attr]);
            }
          }
        },
        'failed' : (data) =>
        {
          defer.reject(data);
        }
      }
    };

    this.ua.sendService(
      this.factoryUri,
      event,
      xml,
      options
    );

    return defer.promise;
  }

  onConferenceFactoryUriUpdated(uri)
  {
    this.factoryUri = uri;
    super.onConferenceFactoryUriUpdated(uri);
  }
};