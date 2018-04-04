const Item = require('./Item');
const Utils = require('../../Base/Utils');

module.exports = class Description extends Item
{
  constructor(information)
  {
    super();

    this._information = information;
  }

  // closedAuthenticated：allowd by presenter
  // openAuthenticated：company allowed
  // anonymous：everyone allowed；
  get admissionPolicy()
  {
    return this.get('admission-policy');
  }
  get attendeePin()
  {
    return this.get('attendee-pin');
  }
  // 0: specificate by organizer
  // 2147483648: everyone
  // 32768: company
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
  get conferenceNumberType()
  {
    return this.get('conference-number-type');
  }
  get conferenceType()
  {
    return this.get('conference-type');
  }
  get hideOSD()
  {
    return Utils.booleanify(this.get('hide-osd'));
  }
  get interactiveBroadcastEnabled()
  {
    return Utils.booleanify(this.get('interactive-broadcast-enabled'));
  }
  get invitees()
  {
    return this.get('invitees');
  }
  get lastUpdateTime()
  {
    return this.get('last-update-time');
  }
  get lastUpdateTimeStamp()
  {
    return this.get('last-update-time-stamp');
  }
  get lobbyCapable()
  {
    return this.get('lobby-capable');
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
  get recurrencePattern()
  {
    return this.get('recurrence-pattern');
  }
  get rtmpInvitees()
  {
    return this.get('rtmp-invitees');
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

  // focus | audio-video | applicationsharing
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