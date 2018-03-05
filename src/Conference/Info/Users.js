const Item = require('./Item');
const Utils = require('../../Base/Utils');
const User = require('./User');

module.exports = class Users extends Item
{
  constructor()
  {
    super();

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

    const user = obj['user'];

    if (typeof user === 'object')
    {
      entity = user['@entity'];
    }

    updatingUser = this.getUser(entity);

    super.update(obj, force);

    const list = Utils.arrayfy(this.get('user'));

    this._userList = list.map(function(userInfo)
    {
      return new User(userInfo);
    });

    this._updatedUser = this.getUser(entity) || updatingUser;
  }

};