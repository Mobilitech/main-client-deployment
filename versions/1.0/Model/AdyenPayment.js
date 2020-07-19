class AdyenPayment
{
  constructor()
  {
    this.reference = "NIL"
    this.amount = {
        "value":0,
        "currency":"NIL"
    };
    this.merchantAccount = "NIL";
    this.countryCode = "NIL";
    this.shopperReference = "NIL";
    this.description = "NIL";
  }
};

module.exports = AdyenPayment;
