class Pass
{
  constructor()
  {
    this.passId = "NIL"
    this.costPrice = 0;
    this.credits = 0;
    this.hasMultiTrip = false;
    this.img = [
      "https://firebasestorage.googleapis.com/v0/b/telepod_mainclient/o/defaults%2Fimg-placeholder.png?alt=media&token=7a94ef0a-c2ff-4178-9f31-f2496d26873b",
      "https://firebasestorage.googleapis.com/v0/b/telepod_mainclient/o/defaults%2Fimg-placeholder.png?alt=media&token=7a94ef0a-c2ff-4178-9f31-f2496d26873b",
      "https://firebasestorage.googleapis.com/v0/b/telepod_mainclient/o/defaults%2Fimg-placeholder.png?alt=media&token=7a94ef0a-c2ff-4178-9f31-f2496d26873b"
    ];
    this.isActive = false;
    this.isInfo = false;
    this.isRecurring = false;
    this.order = 0;
    this.passDuration = 0;
    this.passLevel = -1;
    this.passName = "NIL";
    this.country = "NIL";
    this.currency = "NIL";
    this.reqDeposit = false;
  }
};

module.exports = Pass;
