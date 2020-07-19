class FCMOperation
{
  constructor()
  {
    this.operation = "create"; //create/add/remove
    this.notification_key_name = "NIL"; //originally int, now string
    this.notification_key = "NIL"; // originally int -1, now string
    this.registration_ids = [];
  }
};

module.exports = FCMOperation;