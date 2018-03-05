const EventEmitter = require('events').EventEmitter;
const Debug = require('../../Base/Debug');
const Utils = require('../../Base/Utils');
const Description = require('./Description');
const State = require('./State');
const View = require('./View');
const Users = require('./Users');

const debug = Debug('Apollo:Information');

module.exports = class Information extends EventEmitter
{
  constructor(conference)
  {
    super();

    this._conference = conference;

    this._entity = conference.entity;
    this._version = 0;
    this._time = undefined;
    this._description = new Description(this);
    this._state = new State(this);
    this._view = new View(this);
    this._users = new Users(this);

    this._conference.on('entityChanged', (entity) => 
    {
      this._entity = entity;
    });
  }

  get entity()
  {
    return this._entity;
  }
  get version()
  {
    return this._version;
  }
  get time()
  {
    return this._time;
  }
  get description()
  {
    return this._description;
  }
  get state()
  {
    return this._state;
  }
  get view()
  {
    return this._view;
  }
  get users()
  {
    return this._users;
  }

  update(xml)
  {
    const info = Utils.objectify(xml)['conference-info'];

    debug('update information: %o', info);

    if (this.entity !== info['@entity'])
    {
      debug('entity unmatch!');
      
      return;
    }

    if (this.version < info['@version'])
    {
      switch (info['@state']) 
      {
        case 'full':
          this._fullUpdate(info);
          break;
        case 'partial':
          this._particalUpdate(info);
          break;
        case 'deleted':
          this._deletedUpdate();
          break;
        default:
          break;
      }
    }
  }

  clear()
  {
    this._deletedUpdate();
  }

  _fullUpdate(info)
  {
    this._time = info['now-time'];

    this._description.update(info['conference-description'], true);
    this._state.update(info['conference-state'], true);
    this._view.update(info['conference-view'], true);
    this._users.update(info['users'], true);

    this._checkUpdate(info);
  }
  _particalUpdate(info)
  {
    this._time = info['now-time'];

    this._description.update(info['conference-description']);
    this._state.update(info['conference-state']);
    this._view.update(info['conference-view']);
    this._users.update(info['users']);

    this._checkUpdate(info);
  }
  _deletedUpdate()
  {
    this._version = 0;
    this._time = '';

    this._description.update({}, true);
    this._state.update({}, true);
    this._view.update({}, true);
    this._users.update({}, true);
  }
  _checkUpdate(info)
  {
    if (info['conference-description'])
    {
      this._conference._descriptionUpdated();
    }
    if (info['conference-state'])
    {
      this._conference._stateUpdated();
    }
    if (info['conference-view'])
    {
      this._conference._viewUpdated();
    }
    if (info['users'])
    {
      this._conference._usersUpdated();
    }
  }
};