const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class User extends Item
{
  constructor(obj)
  {
    super(obj);
  }

  get entity()
  {
    return this.get('@entity');
  }
  get displayText()
  {
    return this.get('display-text');
  }
  get endpoint()
  {
    return Utils.arrayfy(this.get('endpoint'));
  }
  get phone()
  {
    return this.get('phone');
  }
  get roles()
  {
    const userRoles = {
      permission : 'attendee', // attendee | presenter | organizer
      demostate  : 'audience' // audience | demonstrator
    };
    const rolesEntry = Utils.arrayfy(this.get('roles')['entry']);
    
    rolesEntry.forEach(function(role)
    {
      switch (role['@entity']) 
      {
        case 'permission':
          userRoles.permission = role['#text'];
          break;
        case 'demostate':
          userRoles.demostate = role['#text'];
          break;
      }
    });

    return userRoles;
  }
  get uid()
  {
    return this.get('uid');
  }
  get userAgent()
  {
    return this.get('user-agent');
  }

  get mediaList()
  {
    let list = [];

    this.endpoint.forEach((endpoint) => 
    {
      const media = endpoint['media'];

      if (media && Array.isArray(media))
      {
        list = list.concat(media);
      }
      else if (media && typeof media === 'object')
      {
        list.push(media);
      }
    });

    return list;
  }

  // main-audio | main=video | applicationsharing
  getMedia(label)
  {
    const media = this.mediaList.find(function(m)
    {
      return m['label'] === label;
    });

    return media;
  }

};