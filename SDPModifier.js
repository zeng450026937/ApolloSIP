const transform = require('sdp-transform');

const SDPModifiers = {
  activeSSL : function(description) 
  {
    description.sdp = description.sdp.replace(/a=setup:actpass\r\n/g, 'a=setup:active\r\n');

    return Promise.resolve(description);
  },
  normalize : function(description) 
  {
    const sdp = transform.parse(description.sdp);

    description.sdp = transform.write(sdp);

    return Promise.resolve(description);
  }
};

module.exports = SDPModifiers;