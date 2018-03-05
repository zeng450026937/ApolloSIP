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

  get presenter()
  {
    const presenter = this.userList.find(function(user) 
    {
      let found = false;

      const shareMedia = user.getMedia('applicationsharing');

      if (shareMedia && shareMedia['status'] === 'sendonly') { found = true; }

      return found;
    });

    return presenter;
  }

  get currentUser()
  {
    const currentUser = this.userList.find(function(user) 
    {
      return user.entity === this._information.from;
    });

    return currentUser;
  }

  getUser(entity)
  {
    return this.userList.find((user) =>
    {
      return user.entity == entity;
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

    this._userList = list.map(function(userInfo)
    {
      const user = new User(userInfo);
      const currentUserEntity = this._information.from;

      // setup user's attached properties.
      user.isCurrentUser = function() 
      {
        return this.entity === currentUserEntity?true:false;
      };

      return user;
    }, this);

    this._updatedUser = this.getUser(entity) || updatingUser;
  }

};