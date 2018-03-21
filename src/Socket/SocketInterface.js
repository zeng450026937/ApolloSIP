const SIP = require('../Base/SIP');
const Url = require('url');

module.exports = class SocketInterface
{
  static Create({ server, socketOptions, proxy })
  {
    const serverUrl = Url.parse(server);
    const proxyUrl = Url.parse(proxy);

    let socketUrl;
    let socketInterface;

    switch (socketOptions.type)
    {
      case 'socketio':
        socketUrl = proxyUrl.href;
        socketOptions.query = `fsaddr=${serverUrl.hostname}`;
        socketInterface = new SIP.SocketIOInterface(socketUrl, socketOptions);
        break;
      case 'websocket':
      default:
        socketUrl = serverUrl.href;
        if (!SIP.Utils.isEmpty(proxy))
        {  
          socketUrl = Url.format({
            protocol : proxyUrl.protocol,
            hostname : proxyUrl.hostname,
            port     : proxyUrl.port,
            pathname : proxyUrl.pathname + serverUrl.hostname,
            slashes  : true
          });
        }
        socketInterface = new SIP.WebSocketInterface(socketUrl, socketOptions);
        break;
    }

    return socketInterface;
  }
  constructor() {}
};
