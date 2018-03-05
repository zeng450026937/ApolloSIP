const Utils = require('../Base/Utils');

const VERSION = '1';

module.exports = class COMMAND 
{
  static get Version() 
  {
    return VERSION;
  }

  static Make(from, to, requestId, body) 
  {
    const request = {
      '@version'   : VERSION,
      '@from'      : from,
      '@to'        : to,
      '@requestId' : requestId
    };
  
    Object.assign(request, body);

    const obj = {
      'request' : request
    };
  
    return Utils.xmlify(obj);
  }

  static Parse(xml) 
  {
    const obj = Utils.objectify(xml);

    if (obj) 
    {
      const response = obj['response'];
      const responseVersion = response['@version'];

      if (responseVersion == VERSION) 
      {
        return response; 
      }
    }
    
    return null;
  }
};