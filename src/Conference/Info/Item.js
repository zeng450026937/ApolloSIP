const Debug = require('../../Base/Debug');

const debug = Debug('Apollo:Item');

module.exports = class Item
{
  constructor(object = {})
  {
    this._internal = object;
  }

  get(name)
  {
    return this._internal[name];
  }

  update(obj, force = false)
  {
    if (!obj) { return; }

    if (force)
    {
      this._internal = obj;
    }
    else
    {
      this.mergeObjectToObject(this._internal, obj);
    }
  }

  mergeObjectToObject(rhys, object) 
  {
    let merged = rhys;

    if ((rhys['@entity'] && rhys['@entity'] !== object['@entity']) ||
        (rhys['@id'] && rhys['@id'] !== object['@id']))
    {
      debug('entity|id unmatch');
      merged = [ rhys, object ];
      merged = merged.filter(function(item)
      {
        return item['@state'] !== 'deleted';
      });
    }
    else
    {
      Object.keys(object).forEach(function(key)
      {
        if (merged[key]) 
        {
          if (Array.isArray(merged[key])) 
          {
            if (Array.isArray(object[key])) 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeArrayToArray(merged[key], object[key]);
              debug(merged[key]);
            }
            else if (typeof object[key] === 'object') 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeObjectToArray(merged[key], object[key]);
              debug(merged[key]);
            }
          }
          else if (typeof merged[key] === 'object') 
          {
            if (Array.isArray(object[key])) 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeArrayToObject(merged[key], object[key]);
              debug(merged[key]);
            }
            else if (typeof object[key] === 'object') 
            {
              debug(`merge ${key}`);
              merged[key] = this.mergeObjectToObject(merged[key], object[key]);
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
        if (object[key] || object[key] !== '') 
        {
          debug(`merge ${key}`);
          merged[key] = object[key];
          debug(`Assign new ${key}: <- ${merged[key]}`);
        }
  
      }, this);  
    }

    return merged;
  }
  mergeObjectToArray(array, object) 
  {
    const entity = object['@entity'] || object['@id'];

    let merged = [];

    let found = false;

    for (let iterator of array) 
    {
      const iterEntity = iterator['@entity'] || iterator['@id'];

      if (iterEntity === entity) 
      {
        found = true;
        debug(`found entity|id ${entity}`);
        iterator = this.mergeObjectToObject(iterator, object);
      }
      merged.push(iterator);
    }

    if (!found) 
    {
      debug(`Not found entity|id ${entity}`);
      merged.push(object);
    }

    merged = merged.filter(function(item)
    {
      return item['@state'] !== 'deleted';
    });

    return merged;
  }
  mergeArrayToObject(object, array) 
  {
    let merged = [ object ];

    merged = this.mergeArrayToArray(merged, array);

    merged = merged.filter(function(item)
    {
      return item['@state'] !== 'deleted';
    });

    return merged;
  }
  mergeArrayToArray(rhys, array) 
  {
    let merged = [];

    for (const iterator of array) 
    {
      merged = this.mergeObjectToArray(rhys, iterator);
    }

    merged = merged.filter(function(item)
    {
      return item['@state'] !== 'deleted';
    });

    return merged;
  }

};