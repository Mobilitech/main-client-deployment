class Transaction
{
  constructor()
  {
    this.creditCardNumber = "NIL";
    this.creditCardType = "NIL";
    this.creditCardToken = "NIL";
    this.hasExpired = true;
    this.isRecurring = false;
    this.passId = "NIL";
    this.passLevel = -1;
    this.paymentAmount = 0;
    this.paymentTime = new Date().getTime();
    this.paymentType = 1;
    this.country = "NIL";
    this.currency = "NIL";
  }
};

module.exports = Transaction;