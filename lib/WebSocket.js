let ws = null;

if (typeof WebSocket !== 'undefined') 
{
  ws = WebSocket;
}
else if (typeof MozWebSocket !== 'undefined') 
{
  /* eslint-disable no-undef */
  ws = MozWebSocket;
  /* eslint-enable no-undef */
}
else if (typeof global !== 'undefined') 
{
  ws = global.WebSocket || global.MozWebSocket;
}
else if (typeof window !== 'undefined') 
{
  ws = window.WebSocket || window.MozWebSocket;
}
else if (typeof self !== 'undefined') 
{
  ws = self.WebSocket || self.MozWebSocket;
}

module.exports = ws;