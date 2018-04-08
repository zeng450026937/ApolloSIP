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

    this._pendings = {};
  }

  get from()
  {
    return this.ua.get('uri');
  }

  get factoryUri()
  {
    return this.ua.get('conferenceFactoryUri');
  }

  isAvariable()
  {
    return super.isAvariable() && (this.factoryUri?true:false);
  }

  createConference(info) 
  {
    debug('createConference()');

    return this.addConference(info)
      .catch((e) => 
      {
        debug('add conference failed. error: %o', e);
        throw e;
      })
      .then((xml) => 
      {
        const conference = Conference.FromInformation(xml, this.ua);

        return Promise.resolve(conference);
      });
  }

  addConference(info) 
  {
    debug('addConference()');

    info = info || {
      '@entity'                : '',
      'conference-description' : {
        'organizer' : {
          'username' : this.from.user,
          'realm'    : this.from.host
        },
        'subject' : 'default conference',
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

    const body = {};

    body[C.ADD_CONFERENCE] = {
      'conference-info' : info
    };

    return this._deferSend(body);
  }

  deleteConference(entity) 
  {
    const body = {};

    body[C.DELETE_CONFERENCE] = {
      'conferenceKeys' : {
        '@entity' : entity
      }
    };

    return this._deferSend(body);
  }

  addVMR(info) 
  {
    const body = {};

    body[C.ADD_VMR] = {
      'conference-info' : info
    };

    return this._deferSend(body);
  }

  getConferenceStatistics() 
  {
    const body = {};

    body[C.GET_CONFERENCE_STATISTICS] = {};

    return this._deferSend(body);
  }

  getConferenceByNumber(number) 
  {
    const body = {};

    body[C.GET_CONFERENCE_BY_NUM] = {
      'conferenceKeys' : {
        '@confNumber' : number
      }
    };

    return this._deferSend(body);
  }

  bookConference(info) 
  {
    const body = {};

    body[C.BOOK_CONFERENCE] = {
      'conference-info' : info
    };

    return this._deferSend(body);
  }

  cancelConference(entity) 
  {
    const body = {};

    body[C.BOOK_CONFERENCE] = {
      'conference-info' : {
        '@entity' : entity,
        '@state'  : 'deleted'
      }
    };

    return this._deferSend(body);
  }

  // startDateTime : Date object
  // endDateTime : Date object
  getConferenceSchedule({ startDateTime, endDateTime }) 
  {
    const body = {};

    body[C.GET_BOOK_CONFERENCE_SCHEDULE] = {
      'startDateTime' : Utils.formatDate(startDateTime),
      'endDateTime'   : Utils.formatDate(endDateTime)
    };

    return this._deferSend(body);
  }

  // dateTime : Date object
  getRunningConference(dateTime) 
  {
    dateTime = dateTime || new Date();

    const body = {};

    body[C.GET_BOOK_CONFERENCE_POINT_RUNNING] = {
      'DateTime' : Utils.formatDate(dateTime)
    };

    return this._deferSend(body);
  }

  getConferenceTemplate(entity) 
  {
    const body = {};

    body[C.GET_BOOK_CONFERENCE_TEMPLATE] = {
      'conference-info' : {
        '@entity' : entity
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

          const code = response['@code'];
          let result;

          for (const attr in response) 
          {
            if (!(/^@/.test(attr))) 
            {
              debug('service command: %s', attr);
              debug('service result: %o', response[attr]);
              result = response[attr];
            }
          }

          switch (code)
          {
            case 'success':
              defer.resolve(result);
              break;
            case 'failure':
              data.cause = code;
              data.result = result;
              defer.reject(data);
              break;
            case 'pending':
              this._pendings[requestId] = defer;
              break;
            default:
              break;
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

};