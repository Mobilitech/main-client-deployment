class Zone
{
  constructor()
  {
    this.zoneId = "NIL";
    this.hasBuzzer = false;
    this.isExclusive = false;
    this.isSuspended = false;
    this.l = [-1,-1];
    this.zoneBoundaries = [];
    this.zoneColor = "NIL"
    this.zoneDepositActive = false;
    this.zoneFare = 0;
    this.zoneUnlockFare = 0;
    this.zoneName = "NIL";
    this.zoneRadius = 200;
    this.zoneTimeBlock = 60000;
    this.country = "NIL";
    this.currency = "NIL";
  }
};

module.exports = Zone;