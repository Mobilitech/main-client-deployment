class Common
{
  constructor()
  {
    this.androidVersion = -1;
    this.announcement = "NIL";
    this.confettiFreeRideSecs = 0;
    this.creditMin = 0;
    this.depositMin = 4900;
    this.freeRideSecs = 60;
    this.geofenceRadiusM = 1000;
    this.geofenceTheftRadiusM = 400;
    this.gpsADTRate = 1;
    this.hotline = {
        "default":"NIL",
        "secondary":"NIL"
    }
    this.iosVersion = -1;
    this.maxUsageInSecs = -1;
    this.minBattPercent = -1;
    this.nearestStationRadiusKM = -1;
    this.operatingHour = {
        "end":2359,
        "lastBooking":2359,
        "start":0
    }
    this.hotlineDefault = "NIL";
    this.hotlineSecondary = "NIL";
    this.operatingHourEnd = 2359;
    this.operatingHourLastBooking = 2359;
    this.operatingHourStart = 0;
    this.pricing={
        "fare":15,
        "timeBlock":60000
    };
    this.pricingFare = 15;
    this.pricingTimeBlock = 60000;
    this.fb_link = "NIL";
    this.instagram_link = "NIL";
    this.youtube_link = "NIL";
    this.webpage_link = "NIL";
    this.faq_link = "NIL";
    this.country = "NIL";
    this.currency = "NIL";
  }
};

module.exports = Common;