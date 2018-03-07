const ErrorMap = {
  60001 : 'Uri Unknown',
  60002 : 'Locked',
  60003 : 'User Count Exceed',
  60004 : 'User Duplicate',
  60005 : 'Send MSG To MCU Failed',
  60006 : 'MCU Request SESS Failed',
  60007 : 'MCU Response IP Invalid',
  60008 : 'GEN MCU SDP Failed',
  60009 : 'MCU Start Session Failed',
  60010 : 'MCU Notify QUIT',
  60011 : 'Endpoint Add Failed',
  60012 : 'User Deleted',
  60013 : 'Conference Deleted',
  60014 : 'Uri Invalid',
  60015 : 'MCU Start AUTH Session Failed',
  60016 : 'License Amount Limit',
  60017 : 'MCU Keep Alive Failed',
  60018 : 'MCU Create Failed',
  60019 : 'MCU Set Param Failed',
  60020 : 'MCU Not Connected',
  60021 : 'Alloc NUM Failed',
  60022 : 'Not Started',
  60023 : 'Has End',
  60024 : 'Join Multi Endpoint',
  60025 : 'Endpoint Duplicate',
  60026 : 'Invalid C3P Request',
  60027 : 'MCU Entry Not Found',
  60028 : 'User Resource Not Found',
  60029 : 'Permission Denied',
  60030 : 'Invalid PIN',
  60031 : 'Invite Miss User Entity',
  60032 : 'Miss Book Info By ID',
  60033 : 'New Failed',
  60034 : 'Run Failed',
  60035 : 'MCU Session Keep Alive Failed',
  60036 : 'New Share Joined',
  60037 : 'Broadcast Layout Not Found',
  60038 : 'Invite VMR Failed',
  60039 : 'Interactive Broadcast Disable',
  60040 : 'Broadcast License Amount Limit',
  60041 : 'Blacklist Limit',
  60042 : 'IP Direct Blacklist Limit',
  60043 : 'Sip Invite Trans H323'
};

class FreeSwitchError extends Error
{
  constructor(data)
  {
    super();

    this.name = 'FreeSwitch Error';
    this.originator = data.originator || 'local';
    this.code = data.code || 0;
    this.cause = data.cause || 'Unknown';
    this.message = data.message || 'Unknown Error';

    if (data.message)
    {
      const reason = data.message.getHeader('Reason');
      // Reason Header
      // APOLLO;cause=60032;text="Conference miss book info by id"

      if (reason)
      {
        const code = reason.split(';')[1].split('=')[1];
        const cause = ErrorMap[code];
        const message = reason.split(';')[2].split('=')[1];

        this.code = Number.parseInt(code);
        this.cause = cause;
        this.message = message;
      }
    }
  }
}

module.exports = {
  FreeSwitchError
};