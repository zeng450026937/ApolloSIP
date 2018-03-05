const EventEmitter = require('events').EventEmitter;
const debug = require('./SIP').debug('Apollo:ConferenceInfo');

const STATE = {
  FULL    : 'full',
  PARTIAL : 'partial',
  DELETED : 'deleted'
};

class ConferenceInfo extends EventEmitter
{
  constructor(conference)
  {
    super();
    this._conference = conference;
    this.entity = conference.entity;
    this.state = null;
    this.version = null;
    this.info = null;
  }

  get uris()
  {
    const uriEntry = this.info['conference-description']['conf-uris']['entry'];

    const uris = {};

    if (Array.isArray(uriEntry)) 
    {
      uriEntry.forEach((entry) => 
      {
        switch (entry['@entity']) 
        {
          case 'focus':
            uris.focus = entry['uri'];
            break;
          case 'audio-video':
            uris.av = entry['uri'];
            break;
          case 'chat':
            uris.chat = entry['uri'];
            break;
          case 'applicationsharing':
            uris.share = entry['uri'];
            break;
        }
      });
    }

    debug(`\nfocus uri: ${uris.focus}\naudio-video uri:${uris.av}\nchat uri:${uris.chat}\napplication-sharing uri:${uris.share}`);
    
    return uris;
  }

  findUser(entity)
  {
    let userArray = this.info['users']['user'];

    if (!Array.isArray(userArray))
    {
      userArray = [ userArray ];
    }

    return userArray.find((user) =>
    {
      return user['@entity'] == entity;
    });
  }

  update(info = {})
  {
    info = info['conference-info'];

    if (!this.entity) this.entity = info['@entity'];
    if (!this.state) this.state = info['@state'];
    if (!this.version) this.version = info['@version'];
    if (!this.info) this.info = info;

    debug('update notify: %o', info);

    const entity = info['@entity'];
    const state = info['@state'];
    const version = info['@version'];

    const originalInfo = Object.assign({}, this.info);

    if (this.entity !== entity)
    {
      throw new Error('Wrong Entity');
    }

    if (this.version < version)
    {
      switch (state) 
      {
        case STATE.FULL:
          {
            debug('FULL update');
            this.info = info;
          }
          break;

        case STATE.PARTIAL:
          {
            debug('PARTIAL update');
            this.info = this.mergeObjectToObject(this.info, info);
          }
          break;

        case STATE.DELETED:
          {
            debug('DELETED update');
            this.info = {};
          }
          break;
      }

      this.emit('updated', { 
        state    : state,
        original : originalInfo,
        updated  : this.info,
        received : info
      });
    }
    else
    {
      debug('Nothing to update');
    }
  }

  mergeObjectToObject(rhys, object, parent) 
  {
    let merged = rhys;

    for (const key in object) 
    {
      if (object.hasOwnProperty(key)) 
      {
        if (merged[key]) 
        {
          if (Array.isArray(merged[key])) 
          {
            if (Array.isArray(object[key])) 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeArrayToArray(merged[key], object[key], key);
              debug(merged[key]);
            }
            else if (typeof object[key] === 'object') 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeObjectToArray(merged[key], object[key], key);
              debug(merged[key]);
            }
          }
          else if (typeof merged[key] === 'object') 
          {
            if (Array.isArray(object[key])) 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeArrayToObject(merged[key], object[key], key);
              debug(merged[key]);
            }
            else if (typeof object[key] === 'object') 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeObjectToObject(merged[key], object[key], key);
              debug(merged[key]);
            }
            else
            {
              debug(`merge ${key}`);
              debug(`Assign #text: ${merged[key]}#${merged[key]['#text']} <- ${object[key]}`);
              merged[key]['#text'] = object[key];
              debug(merged[key]);
            }
          }
          else if (key !== '@entity' && key !== '@id') 
          {
            debug(`merge ${key}`);
            if (merged[key] !== object[key]) 
            {
              if (!(key === '@state' && object[key] === 'partial')) 
              {
                debug(`Assign: ${merged[key]} <- ${object[key]}`);
                merged[key] = object[key];
              }
            }
            else 
            {
              debug(`Equal: ${merged[key]} = ${object[key]}`);
            }
          }
        }
        else 
        {
          debug(`merge ${key}`);
          merged[key] = object[key];
          debug(`Assign new ${key}: <- ${merged[key]}`);
        }
      }
    }

    if (parent)
    {
      if (merged['@state'] === 'deleted')
      {
        merged = null;
        debug(`${parent} deleted`);
      }
      else
      {
        debug(`${parent} updated`);
      }
    }

    return merged;
  }
  mergeObjectToArray(array, object, parent) 
  {
    const entity = object['@entity'] || object['@id'];

    const merged = [];

    let found = false;

    for (let iterator of array) 
    {
      const iterEntity = iterator['@entity'] || iterator['@id'];

      if (iterEntity === entity) 
      {
        found = true;
        debug(`found entity|id ${entity}`);
        iterator = this.mergeObjectToObject(iterator, object, parent);
      }
      merged.push(iterator);
    }

    if (!found) 
    {
      debug(`Not found entity|id ${entity}`);
      merged.push(object);

      if (parent)
      {
        debug(`${parent} added`);
      }
    }

    return merged;
  }
  mergeArrayToObject(object, array, parent) 
  {
    let merged = [ object ];

    merged = this.mergeArrayToArray(merged, array, parent);

    return merged;
  }
  mergeArrayToArray(rhys, array, parent) 
  {
    let merged = [];

    for (const iterator of array) 
    {
      merged = this.mergeObjectToArray(rhys, iterator, parent);
    }

    return merged;
  }
}

module.exports = ConferenceInfo;