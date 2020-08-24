class Trip
{
  constructor()
  {
    this.userId = "NIL";
    this.scooterId = "NIL";
    this.IMEI = "NIL";
    this.passTransactionId = "NIL";
    this.status = "NIL";
    this.tripRefId = "NIL";
    this.saveCreditCard = false;
    this.isMultiTrip = false;
    this.paymentType = "telepodCredit"; // or creditCard
    this.userLocationAtBooking = [-1,-1];
    this.userLocationAtDropOff = [-1,-1];
    this.pickUpStationId = "NIL";
    this.pickUpStationName = "NIL";
    this.pickUpZoneId = "NIL";
    this.pickUpTime = -1;
    this.pickUpZoneFare = 0;
    this.pickUpZoneTimeBlock = 0;
    this.totalFare = 0;
    this.totalDuration = 0;
    this.country = "NIL";
    this.currency = "NIL";
    this.feedback = "NIL";
    this.etcFare = 0;
    this.dropOffStationId = "NIL";
    this.dropOffStationName = "NIL";
    this.dropOffZoneId = "NIL";
    this.dropOffTime = -1;
    this.dropOffZoneFare = 0;
    this.dropOffZoneTimeBlock = 0;
    this.isDropOffInOperatingZone = false;
    this.isDropOffInStation = false;
  }
};

module.exports = Trip;
