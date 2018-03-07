const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class Description extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
  }

  get admissionPolicy()
  {
    return this.get('subject');
  }
  get attendeePin()
  {
    return this.get('attendee-pin');
  }
  get autopromote()
  {
    return this.get('autopromote');
  }
  get bookExpiryTime()
  {
    return this.get('book-expiry-time');
  }
  get bookStartTime()
  {
    return this.get('book-start-time');
  }
  get remindEarly()
  {
    return this.get('remind-early');
  }
  get createEarly()
  {
    return this.get('create-early');
  }
  get confUris()
  {
    return this.get('conf-uris');
  }
  get conferenceId()
  {
    return this.get('conference-id');
  }
  get conferenceNumber()
  {
    return this.get('conference-number');
  }
  get conferenceType()
  {
    return this.get('conference-type');
  }
  get maximumUserCount()
  {
    return this.get('maximum-user-count');
  }
  get organizer()
  {
    return this.get('organizer');
  }
  get presenterPin()
  {
    return this.get('presenter-pin');
  }
  get profile()
  {
    return this.get('profile');
  }
  get scheduleId()
  {
    return this.get('schedule-id');
  }
  get serverMode()
  {
    return this.get('server-mode');
  }
  get startTime()
  {
    return this.get('start-time');
  }
  get subject()
  {
    return this.get('subject');
  }

  getUri(purpose)
  {
    let uris = this.confUris;

    uris = Utils.arrayfy(uris['entry']);

    const uri = uris.find(function(u)
    {
      return u['purpose'] === purpose;
    });

    return uri['uri'];
  }

};