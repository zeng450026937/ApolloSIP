const toplevel = global.window || global;
const xmlparser = require('fast-xml-parser');
const xmlbuilder = require('xmlbuilder');
const fecha = require('fecha');

fecha.masks.default = 'YYYY-MM-DD HH:mm:ss';

exports.xmlify = (obj) => 
{
  return xmlbuilder.create(obj).end();
};

exports.objectify = (xml) => 
{
  return xmlparser.parse(xml, {
    attrPrefix            : '@',
    attrNodeName          : false,
    textNodeName          : '#text',
    ignoreNonTextNodeAttr : false,
    ignoreTextNodeAttr    : false,
    ignoreNameSpace       : false,
    ignoreRootElement     : false,
    textNodeConversion    : true,
    textAttrConversion    : false,
    arrayMode             : false
  });
};

exports.formatDate = fecha.format;
exports.parseDate = fecha.format;

exports.arrayfy = (obj) => 
{
  let array = obj || [];

  if (!Array.isArray(array))
  {
    array = [ obj ];
  }

  return array;
};

const _defer = exports.defer = () =>
{
  const deferred = {};

  deferred.promise = new Promise(function(resolve, reject) 
  {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  
  return deferred;
};

exports.timerDefer = (timeout) =>
{
  timeout = timeout || 5000;
  
  let defer = _defer();
  let timer = setTimeout(() => 
  {
    if (defer) 
    {
      defer.reject('Defer timeout.');
      defer = null;
    }
    clearTimeout(timer);
    timer = null;
  }, timeout);

  return defer;
};

exports.setupEventHandlers = (target, eventHandlers) =>
{
  if (!target)
  {
    return;
  }
  
  for (const event in eventHandlers)
  {
    if (Object.prototype.hasOwnProperty.call(eventHandlers, event))
    {
      target.on(event, eventHandlers[event]);
    }
  }
};
exports.removeEventHandlers = (target, eventHandlers) =>
{
  if (!target)
  {
    return;
  }

  for (const event in eventHandlers)
  {
    if (Object.prototype.hasOwnProperty.call(eventHandlers, event))
    {
      target.removeListener(event, eventHandlers[event]);
    }
  }
};

const _getPrefixedProperty = exports.getPrefixedProperty = (object, name) =>
{
  if (object == null) 
  {
    return;
  }
  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  const prefixedNames = [ name, `webkit${ capitalizedName}`, `moz${ capitalizedName}` ];

  for (const key in prefixedNames) 
  {
    if (prefixedNames.hasOwnProperty(key)) 
    {
      const prefixedName = prefixedNames[key];
      const property = object[prefixedName];

      if (property) 
      {
        return property.bind(object);
      }
    }
  }
};

exports.addEventListener = _getPrefixedProperty(toplevel, 'addEventListener');
exports.removeEventListener = _getPrefixedProperty(toplevel, 'removeEventListener');

exports.isUndefined = (obj) => obj === undefined || obj === null;