const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class View extends Item
{
  constructor()
  {
    super();
  }

  get entityViewList()
  {
    return Utils.arrayfy(this.get('entity-view'));
  }

  getEntityView(entity)
  {
    return this.entityViewList.find((entityView) =>
    {
      return entityView['@entity'] == entity;
    });
  }
};