const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class Users extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
  }

  get participantCount()
  {
    return this.get('@participant-count');
  }

  get userList()
  {    
    return Utils.arrayfy(this.get('user'));
  }

  getUser(entity)
  {
    return this.userList.find((user) =>
    {
      return user['@entity'] == entity;
    });
  }

  update(obj, force = false)
  {
    const count = this.participantCount;

    super.update(obj, force);

    const newCount = this.participantCount;

  }

};