const EventEmitter = require('events').EventEmitter;
const Command = require('./Command');
const Call = require('./Call');
const Conference = require('./Conference');
const Utils = require('./Utils');
const SIP = require('./SIP');
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

module.exports = class ConferenceManager extends EventEmitter 
{
  constructor(ua)
  {
    super();

    this._ua = ua;
    this._uri = ua.get('uri');
    this._conferenceFactoryUri = ua.get('conferenceFactoryUri');

    this._from = `${this._uri._host}\\${this._uri._user}`;
    this._to = this._conferenceFactoryUri;
    this._event = 'conference';
    this._contentType = 'application/conference-ctrl+xml';
  }

  get isAvariable()
  {
    this._conferenceFactoryUri = this._ua.get('conferenceFactoryUri');

    return (this._ua.isRegistered &&
            this._conferenceFactoryUri &&
            this._conferenceFactoryUri != '') ? true : false;
  }

  dialIn(media, conferenceNumber, conferencePIN)
  {
    debug('dialIn()');

    this._checkClient();

    const target = `${conferenceNumber}**${conferencePIN}`;

    return this._redirect(target)
      .catch((error) =>
      {
        debug('redirect error: %s', error.cause);
        error.originator = 'redirect';
        throw error;
      })
      .then((targets) =>
      {
        const defer = Utils.defer();

        const call = new Call(this._ua, targets[0], Call.TYPE.MAIN, media);

        call.connect();

        call.once('confirmed', () =>
        {
          defer.resolve(call);
        });
        call.once('failed', (data) =>
        {
          defer.reject(data);
        });

        return defer.promise;
      })
      .catch((error) => 
      {
        debug('call error: %s', error.cause);
        error.originator = 'call';
        throw error;
      })
      .then((call) =>
      {
        return this.upgrade(call);
      })
      .catch((error) => 
      {
        debug('upgrade call to conference failed: %s', error.cause);
        error.originator = 'upgrade';
        throw error;
      });
  }

  meetnow(media, participants = [], joinAfterConnected = true) 
  {
    this._checkClient();
    this._checkFactory();

    return this.createConference()
      .then((conference) => 
      {
        for (const participant of participants) 
        {
          conference.addUser(participant)
            .then((user) =>
            {
              debug('add user successed %o', user);
            })
            .catch((e) =>
            {
              debug('add user failed: %o', e);
            });
        }
        if (joinAfterConnected)
          return conference.join(media);
        else
          return Promise.resolve(conference);
      })
      .catch((e) =>
      {
        debug('join conference failed.');
        throw e;
      });
  }

  upgrade(call, participants = []) 
  {
    if (!(call instanceof Call))
    {
      throw new TypeError('Call Instance is Required');
    }

    this._checkClient();

    // Situation #1
    // A confrence mcu session upgrade to conference.
    if (call.isInConference()) 
    {
      const { focusUri, entity } = call._conferenceId;
      const conference = new Conference(this._ua, focusUri, entity);

      const defer = Utils.defer();

      conference.connect();
      conference.avChannel = call;

      conference.once('notify', () =>
      {
        for (const participant of participants) 
        {
          conference.addUser(participant)
            .then((data) =>
            {
              debug('add user successed %o', data);
            })
            .catch((e) =>
            {
              debug('add user failed: %o', e);
            });
        }
        defer.resolve(conference);
      });
      conference.once('failed', (data) =>
      {
        debug('connect conference failed.');
        defer.reject(data);
      });

      return defer.promise;
    }
    // Situation #2
    // A normal session upgrade to conference.
    else 
    {
      // ==FLOW==
      // -> create conference
      // -> connect conference
      // -> add participants to conference
      // -> refer to audio-video uri
      // -> terminate current session
      // -> join conference

      return this.meetnow(participants, false)
        .then((conference) => 
        {
          // once refer is accepted, call will terminate current session by default.
          return call.refer(conference._uris.av)
            .catch((e) =>
            {
              debug('refer failed.');
              throw e;
            })
            .then(() => 
            {
              return Promise.resolve(conference);
            });
        })
        .then((conference) => 
        {
          return conference.join(call.media);
        })
        .catch(handleError);
    }

    function handleLog(e) 
    {
      debug('error: %o', e);
    }
    function handleError(e)
    {
      handleLog(e);
      throw e;
    }
  }

  createConference(conferenceInfo) 
  {
    this._checkClient();
    this._checkFactory();

    return this.addConference(conferenceInfo)
      .catch((e) => 
      {
        debug('add conference failed. error: %o', e);
        throw e;
      })
      .then((info) => 
      {
        const { entity, focusUri } = info['conference-info']; // TODO

        const conference = new Conference(this._ua);

        return conference.connect(focusUri, entity);
      })
      .catch((e) => 
      {
        debug('connect conference failed. error: %o', e);
        throw e;
      });
  }

  addConference(conferenceInfo) 
  {
    const body = {};
    const defaultInfo = {
      '@entity'                : '',
      'conference-description' : {
        'organizer' : {
          'username' : this._uri.user,
          'realm'    : this._uri.host
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

  // private method

  _checkClient() 
  {
    if (!this._ua.isRegistered)
    {
      debug('Client is not registered.');
      throw new SIP.Exceptions.NotReadyError();
    }
  }

  _checkFactory() 
  {
    this._conferenceFactoryUri = this._ua.get('conferenceFactoryUri');

    if (!this._conferenceFactoryUri || this._conferenceFactoryUri == '')
    {
      debug('ConferenceFactory is not avariable.');
      throw new SIP.Exceptions.NotReadyError();
    }
  }

  _deferSend(body) 
  {
    if (!this.checkFactory())
      return Promise.reject('No conference factory uri.');

    const defer = Utils.defer();
    const requestId = SIP.Utils.createRandomToken(10, 10);
    const xml = Command.Make(this._from, this._to, requestId, body);
    const options = {
      contentType   : this._contentType,
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

    this._ua.sendService(
      this._conferenceFactoryUri,
      this._event,
      xml,
      options
    );

    return defer.promise;
  }

  _redirect(target)
  {
    debug('redirect()');

    const defer = Utils.defer();
    const session = this._ua.call(target, { withoutSDP: true });

    session.once('failed', (data) =>
    {
      debug('failed %s cause: %s', data.originator, data.cause);

      const message = data.message;

      if (!message)
      {
        defer.reject(data);
        
        return;
      }

      switch (true) 
      {
        case /^30[1-2]$/.test(message.status_code):
          {
            let contacts = message.getHeaders('contact').length;
            let contact = {};
            const targets = [];

            while (contacts--) 
            {
              contact = message.parseHeader('contact', contacts);
              targets.push(contact.uri.toString());
            }

            debug('get conference uris: %o', targets);

            // should have a least one contactUri.
            if (targets.length) 
            {
              defer.resolve(targets);
            }
            else 
            {
              data.cause = SIP.C.causes.NOT_FOUND;
              defer.reject(data);
            }
          }
          break;
        case /^480$/.test(message.status_code):
          // TODO:parse conference info here.
          data.conference = {};
          defer.reject(data);
          break;
        default:
          defer.reject(data);
          break;
      }
    });

    return defer.promise;
  }
};