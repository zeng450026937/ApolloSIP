# ApolloSip

The SIP library used in Apollo Project.

## Install

  git clone git@gitlab.leucs.com:server-app/ApolloSip.git

## Build

  npm install && npm run build

## Interface

* UA

User Agent. The core of all service.

* Call

Handle SIP session and peer connection.
Provide P2P ability.

* CallManager

Manage all incoming and outgoing call.

* Conference

Provide conference control IF.

* ConferenceManager

Provide conference managment IF.

## Exsample

```js
const configuration = {
  uri: 'username@meeting.yealinkvc.com',
  password: 'password',
  display_name: 'Yealink'
  server: 'ws://meeting.yealinkvc.com'
};
const ua = new UA(configuration);
const call = new Call();
const callManager = new CallManager();
const conference = new Conference();
const conferenceManager = new ConferenceManager();

call.ua = ua;
callManager.ua = ua;
conference.ua = ua;
conferenceManager.ua = ua;

// P2P call
call.target = 'target@meeting.yealinkvc.com';
call.connect();
call.on('confirmed', ()=>
{
  call.disconnect();
});

// join IVR
conference.number = 123456;
conference.pin = 123456;
conference.dialIn();
conference.on('connected', ()=>
{
  conference.disconnect();
});
// conference control
conference.entity = 'conferenceEntity';
conference.focusChannel.target = 'foucsUri@meeting.yealinkvc.com';
conference.connect();
conference.on('connected', ()=>
{
  conference.addUser('user@meeting.yealinkvc.com')
    .then((result)=>
    {
      console.log('add user: ', result);
    });
});

// conference management
const info = {
  '@entity'                : '',
  'conference-description' : {
    'organizer' : {
      'username' : this.from._user,
      'realm'    : this.from._host
    },
    'subject' : 'Conference',
    'profile' : 'default' // default | demonstrator
  },
  'conference-view' : {
    'entity-view ' : [
      { '@entity': 'audio-video' },
      { '@entity': 'chat' },
      { '@entity': 'applicationsharing' }
    ]
  }
};
const conf = conferenceManager.createConference(info);
conf.addUser('user@meeting.yealinkvc.com');

conferenceManager.addConference(info);

const information = conferencemanager.getConferenceByNumber(123456);
const description = information.description;
const state = information.state;
const view = information.view;
const users = information.users;
```