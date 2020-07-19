class GPS
{
  constructor()
  {
    this.IMEI = "NIL";
    this.accountGroup = "NIL";
    this.scooterId = "NIL"
    this.BatteryId = "NIL";
    this.Battery = -1;
    this.Mileage = 0;
    this.action = -1;
    this.inStation = false;
    this.lastImg = "NIL";
    this.lastSubmitted = new Date().getTime();
    this.lastStatusChange = new Date().getTime();
    this.lastUsed = new Date().getTime();
    this.lastUser = "NIL";
    this.lat = -1;
    this.lng = -1;
    this.alt = -1;
    this.rating = -1;
    this.remoteAddress = -1;
    this.stationId = "NIL";
    this.status = "NIL";
    this.totalUsageTime = -1;
    this.connectedHost = "NIL";
    this.firmVer = "NIL"
    this.GPS_Status = 0;
    this.GPS_Model = "NIL";
    this.heartBeatTimeUnix = new Date().getTime();
  }
};

module.exports = GPS;
