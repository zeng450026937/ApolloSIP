const Item = require('./Item');

module.exports = class State extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
  }

  get active()
  {
    return Boolean(this.get('active'));
  }
  get locked()
  {
    return Boolean(this.get('locked'));
  }

};