const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class State extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
  }

  get active()
  {
    return Utils.booleanify(this.get('active'));
  }
  get applicationSharing()
  {
    return Utils.booleanify(this.get('applicationsharing'));
  }
  get locked()
  {
    return Utils.booleanify(this.get('locked'));
  }

};