class Televery
{
  constructor()
  {
    this.userId = "NIL";
    this.tripId = "NIL";
    this.scooterId = "NIL";
    this.batteryIn = "NIL";
    this.batteryOut = "NIL";
    this.stationId = "NIL";
    this.stationName = "NIL";
    this.MYSCredits = 0;
    this.SGPCredits = 0;
    this.userFoundAt = "SGP";
    this.refId = "NIL";
    this.userReqTime = parseInt(new Date().getTime());
  }
};

module.exports = Televery;