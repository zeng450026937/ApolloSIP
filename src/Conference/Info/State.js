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
    return this.get('active')==='false'?false:true;
  }
  get locked()
  {
    return this.get('locked')==='false'?false:true;
  }

};