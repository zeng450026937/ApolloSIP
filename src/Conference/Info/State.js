const Item = require('./Item');

module.exports = class State extends Item
{
  constructor()
  {
    super();
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