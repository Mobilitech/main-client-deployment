class Station
{
  constructor()
  {
    this.stationId = "NIL"
    this.batteryAvail = 0;
    this.dockingAvail = 999
    this.geofenceRadiusM = 200;
    this.isBTStation = false;
    this.l = [-1,-1];
    this.scooterAvail = 0;
    this.scooterBatteryLow = 0;
    this.stationName = "NIL";
    this.subStationName = "NIL"
    this.zoneId = "NIL"
    this.img = [];
  }
};

module.exports = Station;
