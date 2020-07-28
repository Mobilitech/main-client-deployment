class User
{
  constructor()
  {
    this.authenticated = false;
    this.contact = "NIL"; //originally int, now string
    this.countryCode = "NIL"; // originally int -1, now string
    this.credits = 0;
    this.country = "NIL";
    this.currency = "NIL";
    this.customerId = "NIL";
    this.registrationDate = -1;
    this.email = "NIL";
    this.method = "NIL";
    this.name = "NIL";
    this.OS = "NIL";
    this.deposit = 0;
    this.tripCount = 0;
    this.totalRideSecs = 0;
    this.statusCode = 0;
    this.restoreId = "NIL";
    this.FCMToken = "NIL";
    this.creditCardNumber = "NIL";
    this.creditCardToken = "NIL";
    this.creditCardType = "NIL";
    this.creditCardUID = "NIL";
  }
};

module.exports = User;