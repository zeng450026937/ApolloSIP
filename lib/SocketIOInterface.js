const IO = require('socket.io-client');
const Grammar = require('./Grammar');
const debug = require('debug')('SIP:SocketIOInterface');
const debugerror = require('debug')('SIP:ERROR:SocketIOInterface');

debugerror.log = console.warn.bind(console);

function on(obj, ev, fn) 
{
  obj.on(ev, fn);
  
  return {
    destroy : function() 
    {
      obj.removeListener(ev, fn);
    }
  };
}

module.exports = class SocketIOInterface
{
  constructor(url, options)
  {
    debug('new() [url:"%s"]', url);

    this._url = url;
    this._options = options;
    this._sip_uri = null;
    this._via_transport = null;
    this._socket = null;

    const parsed_url = Grammar.parse(url, 'absoluteURI');

    if (parsed_url === -1)
    {
      debugerror(`invalid WebSocket URI: ${url}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else if (parsed_url.scheme !== 'wss' && parsed_url.scheme !== 'ws')
    {
      debugerror(`invalid WebSocket URI scheme: ${parsed_url.scheme}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else
    {
      this._sip_uri = `sip:${parsed_url.host}${parsed_url.port ? `:${parsed_url.port}` : ''};transport=ws`;
      this._via_transport = parsed_url.scheme.toUpperCase();
    }
  }

  get via_transport()
  {
    return this._via_transport;
  }

  set via_transport(value)
  {
    this._via_transport = value.toUpperCase();
  }

  get sip_uri()
  {
    return this._sip_uri;
  }

  get url()
  {
    return this._url;
  }

  connect()
  {
    debug('connect()');

    if (this.isConnected())
    {
      debug(`WebSocket ${this._url} is already connected`);

      return;
    }
    else if (this.isConnecting())
    {
      debug(`WebSocket ${this._url} is connecting`);

      return;
    }

    if (this._socket)
    {
      this.disconnect();
    }

    debug(`connecting to WebSocket ${this._url}`);

    try
    {
      this._socket = new IO(this._url, this._options);

      this._socket.binaryType = 'arraybuffer';

      this.onopen = on(this._socket, 'connect', this._onOpen.bind(this));
      this.onclose = on(this._socket, 'disconnect', this._onClose.bind(this));
      this.onmessage = on(this._socket, 'message', this._onMessage.bind(this));
      this.onerror = on(this._socket, 'error', this._onError.bind(this));
    }
    catch (e)
    {
      this._onError(e);
    }
  }

  disconnect()
  {
    debug('disconnect()');

    if (this._socket)
    {
      // Unbind websocket event callbacks.
      this.onopen.destroy();
      this.onclose.destroy();
      this.onmessage.destroy();
      this.onerror.destroy();

      this._socket.close();
      this._socket = null;
    }
  }

  send(message)
  {
    debug('send()');

    if (this.isConnected())
    {
      this._socket.send(message);

      return true;
    }
    else
    {
      debugerror('unable to send message, WebSocket is not open');

      return false;
    }
  }

  isConnected()
  {
    return this._socket && this._socket.connected;
  }

  isConnecting()
  {
    return this._socket && this._socket.io.readyState === 'connecting';
  }


  /**
   * WebSocket Event Handlers
   */

  _onOpen()
  {
    debug(`WebSocket ${this._url} connected`);

    this.onconnect();
  }

  _onClose({ wasClean, code, reason })
  {
    debug(`WebSocket ${this._url} closed`);

    if (wasClean === false)
    {
      debug('WebSocket abrupt disconnection');
    }

    const data = {
      socket : this,
      error  : !wasClean,
      code,
      reason
    };

    this.ondisconnect(data);
  }

  _onMessage(data)
  {
    debug('received WebSocket message');

    this.ondata(data);
  }

  _onError(e)
  {
    debugerror(`WebSocket ${this._url} error: %o`, e);
  }

};
