const EventEmitter = require('events').EventEmitter;
const Debug = require('../../Base/Debug');
const Utils = require('../../Base/Utils');
const Description = require('./Description');
const State = require('./State');
const View = require('./View');
const Users = require('./Users');

const debug = Debug('Apollo:Information');
const warn = Debug('Apollo:Information:Warn');

warn.log = console.warn.bind(console);

module.exports = class Information extends EventEmitter
{
  constructor(conference)
  {
    super();

    this._conference = conference;

    this._entity = undefined;
    this._version = 0;
    this._time = undefined;
    this._description = new Description(this);
    this._state = new State(this);
    this._view = new View(this);
    this._users = new Users(this);
  }

  get from()
  {
    return this._conference?this._conference.from:null;
  }
  get confEntity()
  {
    return this._conference?this._conference.entity:null;
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
    let info;

    if (typeof xml === 'string')
    {
      info = Utils.objectify(xml)['conference-info'];
    }
    else if (typeof xml === 'object')
    {
      info = xml['conference-info'];
    }
    else
    {
      warn('Only xml string or object is accepted.');

      return;
    }

    debug('Update information: %o', info);

    if ((this.confEntity && this.confEntity !== info['@entity']) ||
        (this.entity && this.entity !== info['@entity']))
    {
      warn('Update information failed. Error: entity unmatch. %s', this.entity);

      return;
    }
    
    if (!this.entity)
    {
      this._entity = info['@entity'];
    }

    if (!info['@version'] ||
        (info['@version']&&this.version < info['@version'])
    )
    {      
      switch (info['@state']) 
      {
        case 'full':
          this._fullUpdate(info);
          break;
        case 'partial':
          if (this._conference && this.version && (info['@version'] - this.version > 1))
          {
            warn('Missing information. current version: %d, received version: %d', this.version, info['@version']);
            this._conference.getConference()
              .then((full_info) =>
              {
                this.update(full_info);
              });
          }
          else
          {
            this._particalUpdate(info);
          }
          break;
        case 'deleted':
          this._deletedUpdate();
          break;
        default:
          warn('Missing state. Use partial update.');
          this._particalUpdate(info);
          break;
      }
    }
    else
    {
      debug('illegal version');
    }
  }

  clear()
  {
    this._deletedUpdate();
  }

  isShareAvariable(userEntity)
  {
    userEntity = userEntity || this._conference.from;

    let sharePermission = false;

    const profile = this.description.profile;
    const user = this.users.getUser(userEntity);

    if (!user) { return false; }

    switch (profile) 
    {
      case 'default':
        sharePermission = true;
        break;
      case 'demonstrator':
        sharePermission = user.roles.demostate === 'demonstrator'?true:
          (user.roles.permission === 'presenter' || 
           user.roles.permission === 'organizer')?true:false;
        break;
    }

    return sharePermission;
  }

  _fullUpdate(info)
  {
    this._version = info['@version'];
    this._time = info['now-time'];

    this._description.update(info['conference-description'], true);
    this._state.update(info['conference-state'], true);
    this._view.update(info['conference-view'], true);
    this._users.update(info['users'], true);

    this._checkUpdate(info);
  }
  _particalUpdate(info)
  {
    const participantCount = this.users.participantCount;

    this._version++;
    this._time = info['now-time'];

    this._description.update(info['conference-description']);
    this._state.update(info['conference-state']);
    this._view.update(info['conference-view']);
    this._users.update(info['users']);

    this._checkUpdate(info);

    if (!this._conference) { return; }
    
    const participantCountDiff = this.users.participantCount - participantCount;

    if (participantCountDiff > 0)
    {
      this._conference._userAdded(this.users.updatedUser);
    }
    else if (participantCountDiff === 0)
    {
      this._conference._userUpdated(this.users.updatedUser);
    }
    else
    {
      this._conference._userDeleted(this.users.updatedUser);
    }
  }
  _deletedUpdate()
  {
    this._version = 0;
    this._time = '';
    this._entity = null;

    this._description.update({}, true);
    this._state.update({}, true);
    this._view.update({}, true);
    this._users.update({}, true);
  }
  _checkUpdate(info)
  { 
    if (!this._conference) { return; }

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