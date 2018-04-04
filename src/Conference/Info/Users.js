const Item = require('./Item');
const Utils = require('../../Base/Utils');
const User = require('./User');

module.exports = class Users extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
    this._userList = [];
    this._updatedUser = {};
  }

  get updatedUser()
  {
    return this._updatedUser;
  }

  get participantCount()
  {
    return this.get('@participant-count');
  }

  get userList()
  {
    return this._userList;
  }

  get sharingUser()
  {
    const sharingUser = this.userList.find(function(user) 
    {
      return user.isSharing();
    });

    return sharingUser;
  }

  get currentUser()
  {
    const currentUser = this.userList.find(function(user) 
    {
      return user.isCurrentUser();
    });

    return currentUser;
  }

  getUser(entity)
  {
    return this.userList.find((user) =>
    {
      return user.entity === entity;
    });
  }

  update(obj, force = false)
  {
    if (!obj) { return; }

    let entity = undefined;
    let updatingUser = undefined;

    const userObj = obj['user'];

    if (typeof userObj === 'object')
    {
      entity = userObj['@entity'];
    }

    updatingUser = this.getUser(entity);

    super.update(obj, force);

    const list = Utils.arrayfy(this.get('user'));

    // TODO
    // we should use the previous object instead of create new one every time.
    this._userList = list.map(function(userInfo)
    {
      const conference = this._information._conference;

      const user = new User(userInfo);
      const currentUserEntity = this._information.from;
      const organizer = this._information.description.organizer;

      // setup user's attached properties.
      user.isCurrentUser = function() 
      {
        return this.entity === currentUserEntity;
      };

      user.isOrganizer = function()
      {
        return user.uid === organizer.uid;
      };

      user.setFilter = function({ label, ingress, egress })
      {
        if (!conference) 
        { 
          throw new Error('Missing conference');
        }

        label = label || 'main-audio';

        const media = {
          'label' : label
        };

        if (ingress !== undefined)
        {
          media['media-ingress-filter'] = ingress?'unblock':'block';
        }
        if (egress !== undefined)
        {
          media['media-egress-filter'] = egress?'unblock':'block';
        }

        return conference.modifyEndpointMedia({ entity: this.entity, media: media });
      };
      user.setAudioFilter = function({ ingress, egress })
      {
        return this.setFilter({
          label   : 'main-audio',
          ingress : ingress,
          egress  : egress
        });
      };
      user.setVideoFilter = function({ ingress, egress })
      {
        return this.setFilter({
          label   : 'main-video',
          ingress : ingress,
          egress  : egress
        });
      };

      user.allow = function(granted)
      {
        if (!conference) 
        { 
          throw new Error('Missing conference');
        }

        if (this.isOnHold())
        {
          return conference.setLobbyAccess({ entity: this.entity, granted: granted });
        }
        else
        {
          throw new Error('Should only allow on-hold user');
        }
      };

      user.sendMessage = function(message)
      {
        if (!conference) 
        { 
          throw new Error('Missing conference');
        }

        return conference.ua.sendMessage(this.entity, message);
      };

      return user;
    }, this);

    this._updatedUser = this.getUser(entity) || updatingUser;
  }

};