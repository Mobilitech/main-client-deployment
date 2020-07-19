class TripQueue
{
  constructor()
  {
    this.userId = "NIL";
    this.tripId = "NIL"
    this.pickUpStationId = "NIL";
    this.from = "NIL";
    this.to = "NIL";
    this.status = "NIL";
    this.bookingTime = new Date().getTime();
  }
};

module.exports = TripQueue;
