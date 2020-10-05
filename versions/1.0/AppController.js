'use strict';
//HEAVY TODO!!
const jwt = require('jsonwebtoken');
const Q = require('q');

const logger = app_require('util/loggerUtil.js');
const algorithm = app_require('util/Algorithm.js');
const telepodDetails = app_require('telepod_details.js');
const TripController = app_require('versions/1.0/TripController.js');
const DBController = app_require('versions/1.0/DBController.js');
const HardwareController = app_require('versions/1.0/AppHardwareController.js')
var keygen = require("keygenerator");
const countryIso = require('country-iso');

const dbUtil = app_require('util/DBUtil.js');

const stationModel = app_require('versions/1.0/Model/Station.js');
const zoneModel = app_require('versions/1.0/Model/Zone.js');
const tripModel = app_require('versions/1.0/Model/Trip.js');
const projectGroupModel = app_require('versions/1.0/Model/ProjectGroup.js');
const FCMOpsModel = app_require('versions/1.0/Model/FCMOperation.js');
const ScooterReportModel = app_require('versions/1.0/Model/ScooterReport.js');
const userModel = app_require('versions/1.0/Model/User.js');
const commonModel = app_require('versions/1.0/Model/Common.js');
const transactionModel = app_require('versions/1.0/Model/Transaction.js');
const paymentIntentModel = app_require('versions/1.0/Model/PaymentIntent.js'); 
const paymentMethodModel = app_require('versions/1.0/Model/PaymentMethod.js');
const passModel = app_require('versions/1.0/Model/Pass.js');

const nodemailer = require('nodemailer');
const Nexmo = require('nexmo');

const nexmo = new Nexmo({
  apiKey: telepodDetails.nexmoKey,
  apiSecret: telepodDetails.nexmoSecret
});


exports.getAllStations = function(req, res)
{
  var stationToRet = [];
  const db3 = dbUtil.admin3.database();
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  const stationRef = accountGroup === undefined || accountGroup === "NIL" ? 
    db3.ref("Stations") : db3.ref(accountGroup).child("Stations");
  logger.logAPICall("NIL","/1.0/getAllStations@40",[accountGroup],req.session.uid);
  stationRef.once("value").then(function(snapshot){
    if(!snapshot.exists())
    {
      res.json(stationToRet);
    }
    else
    {
      snapshot.forEach(function(_stationObj){
        var _stationModel = new stationModel();
        Object.assign(_stationModel,_stationObj.val(),{"stationId":_stationObj.ref.key});
        stationToRet.push(_stationModel);
      });
      res.json(stationToRet);
    }
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/getAllStations@1663","Error 1.0_1663",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,204,"https://ibb.co/k2zQzG");
  });
}

exports.getOperatingZones = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const db3 = dbUtil.admin3.database();
  const _accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  var _arrayToReturn = [];
  logger.logAPICall(ip,"/1.0/getOperatingZones@1672",[_accountGroup],req.session.uid);
  const zoneRef = _accountGroup === undefined || _accountGroup === "NIL" ? db3.ref("Zone") :
    db3.ref(_accountGroup).child("Zone");
  zoneRef.once("value").then(function(result){
    if(result.exists())
    {
      result.forEach(function(snapshot){
        var _zoneObj = new zoneModel();
        Object.assign(_zoneObj,snapshot.val(),{
          "zoneId":snapshot.ref.key
        });
        _arrayToReturn.push(_zoneObj);
      });
      res.json(_arrayToReturn);
    }
    else
    {
      res.json(_arrayToReturn);
    }
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getOperatingZones@1692","Error 1.0_1692",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.quickBook = function(req,res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(req.query.userId === undefined || req.query.userId === "NIL"){
      logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/quickBook@683","Unlock Scooter Error\n[QB1_7_689]",
        "There seems to be a problem in processing your request. Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(req.query.scooterId === undefined){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/quickBook@689","Unlock Scooter Error\n[QB1_7_695]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(req.query.stationId === undefined){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/quickBook@695","Unlock Scooter Error\n[QB1_7_701]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(req.query.userLat === undefined || isNaN(req.query.userLat)){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/quickBook@701","Unlock Scooter Error\n[QB1_7_707]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(req.query.userLng === undefined || isNaN(req.query.userLng)){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/quickBook@701","Unlock Scooter Error\n[QB1_7_707]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  var userId = req.query.userId;
  var scooterId = req.query.scooterId;
  var _stationId = req.query.stationId;
  var _paymentType = req.query.paymentType !== undefined ? req.query.paymentType : "trykeCredit";

  var _userLat = parseFloat(req.query.userLat);
  var _userLng = parseFloat(req.query.userLng);
  var _saveCreditCard = req.query.saveCreditCard ? req.query.saveCreditCard : true;
  _saveCreditCard = (_saveCreditCard == "true" || _saveCreditCard == true) ? true : false;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/quickBook@138",[userId,scooterId,_stationId,_userLat,_userLng,_paymentType,_saveCreditCard,accountGroup],req.session.uid);

  TripController.quickBook(userId,scooterId,_stationId,_userLat,_userLng,
      _paymentType,_saveCreditCard,accountGroup).then(function(trip){
      res.json(trip);
    }).catch(function(err){
      if(err == null || err == undefined)
      {
        logger.catchFunc2(ip,"ERROR","/1.0/quickBook@146","Unlock Scooter Error\n[QB1_7_779]",
          "There seems to be a problem in processing your request. Please try again!",
          res,400,"https://ibb.co/k2zQzG");
      }
      else if(err.status !== undefined && err.status == "ERROR_BAL")
      {
        logger.catchFunc2(ip,"ERROR_BAL","/1.0/quickBook@158","Unlock Scooter Error\n[QB1_8_158]",
          "Insufficient TRYKE credit to start a trip! Head to wallet for more information!",
          res,400,"https://ibb.co/k2zQzG");
      }
      else if(err.status !== undefined && err.status == "ERROR_ZONE_SUSPENDED")
      {
        logger.catchFunc2(ip,"ERROR_ZONE_SUSPENDED","/1.0/quickBook@164","Unlock Scooter Error\n[QB1_8_164]",
          "This TRYKE zone is suspended at the moment! For more information, contact our customer support via in-app!",
          res,400,"https://ibb.co/k2zQzG");
      }
      else if(err.status !== undefined && err.status == "ERROR_INUSE")
      {
        logger.catchFunc2(ip,"ERROR","/1.0/quickBook@170","Unlock Scooter Error\n[QB1_7_170]",
        "This scooter has been booked by other TRYKE user.",
        res,400,"https://ibb.co/k2zQzG");
      }
      else {
        logger.catchFunc2(ip,"ERROR","/1.0/quickBook@175","Unlock Scooter Error\n[QB1_7_175]",
          "There seems to be a problem in processing your request. Please try again!",
          res,400,"https://ibb.co/k2zQzG");
      }
    });


}

exports.insertPromo = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(!req.query.userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/insertPromo@172","Promo Redeem Error\n[IP1_7_192]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!req.query.promoId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/insertPromo@179","Promo Redeem Error\n[IP1_7_199]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/insertPromo@185",[req.query.userId,req.query.promoId,accountGroup],
    req.session.uid);
  DBController.insertPromo(req.query.userId,req.query.promoId,accountGroup).then(function(response){
    res.json(response);
  }).catch(function(error){
    if(error !== undefined && error.status == "ERROR_USED")
    {
      logger.catchFunc2(ip,"ERROR_USED","/1.0/insertPromo@192","Promo Redeem Error",
        "The inserted promo has been used! Please try another!",
        res,400,"https://ibb.co/k2zQzG");
    }
    else if(error !== undefined && error.status == "ERROR_LIMIT")
    {
      logger.catchFunc2(ip,"ERROR_LIMIT","/1.0/insertPromo@198","Promo Limit Error",
        "This promo has reached its limit! Please try another!",
        res,400,"https://ibb.co/k2zQzG");
    }
    else {
      logger.catchFunc2(ip,"ERROR","/1.0/insertPromo@203","Promo Redeem Error\n[IP1_7_222]",
        "Invalid promo code inserted! Please use another code!",
        res,400,"https://ibb.co/k2zQzG");
    }
  });
}

exports.getAllPass = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  var _userId = req.query.userId ? req.query.userId : "NIL";
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/getAllPass@216",[_userId,accountGroup],req.session.uid);

  DBController.getAllPass(_userId,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getAllPass@221","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getPassObj = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  if(req.query.passId === undefined){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getPassObj@233","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var passId = req.query.passId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/getPassObj@239",[passId,accountGroup],req.session.uid);
  DBController.getPassOBJ(passId,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getPassObj@243","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.checkActiveTrip = function(req, res)
{
  const deferred = Q.defer();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(req.query.userId === undefined){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/checkActiveTrip@252","Error 24",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const userId = req.query.userId;
  const _accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/checkActiveTrip@259",[userId,_accountGroup],req.session.uid);

  try {
    const db = dbUtil.admin.database();
    const tripArrayToReturn = [];
    const nowTime = new Date().getTime()
  
    const tripRef = _accountGroup === "NIL" || _accountGroup === undefined ?
      db.ref("Trips").child(userId) : db.ref(_accountGroup).child("Trips").child(userId);

    tripRef.orderByChild("bookingTime").limitToLast(1).once("value").then(function(_tripObj){
      if (!_tripObj.exists())
      {
        res.json([]);
      }
      else {
        var tripIdToFind = Object.keys(_tripObj.val())[0];
        var tripRefIdToFind = _tripObj.child(tripIdToFind).child("tripRefId").exists() ?
          _tripObj.val()[tripIdToFind]["tripRefId"] : "NIL";

        return tripRef.orderByChild("tripRefId").equalTo(tripRefIdToFind).once("value");
      }
    }).then(function(tripObj){
      tripObj.forEach(function(childSnapShot2){
        var _tripObj = new tripModel();
        Object.assign(_tripObj,childSnapShot2.val(),{
          "tripId": childSnapShot2.ref.key,
          "status": childSnapShot2.child("status").exists() ?
            childSnapShot2.val()["status"] : "CANCELLED",
          "bookingTime": childSnapShot2.child("bookingTime").exists() ?
            parseInt(childSnapShot2.val()["bookingTime"]) : nowTime
        })

        if(_tripObj.status == "DROPOFF_RETURNED" && ((nowTime - _tripObj.bookingTime) >= 5400000)) // 90 mins
        {
          _tripObj["status"] = "DROPOFF_COMPLETION";
        }
        tripArrayToReturn.push(_tripObj)
      });
      res.json(tripArrayToReturn);
      deferred.resolve;
    }).catch(function(error){
      throw(logger.logErrorReport("ERROR","/1.0/checkActiveTrip@297",[error]));
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/checkActiveTrip@300",[e]));
    logger.catchFunc2(ip,"ERROR","/1.0/checkActiveTrip@301","Error 1.001",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    deferred.reject;
  }
  return deferred.promise;
}

exports.getUserActivePass = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getUserActivePass@306","Error 1.0_306",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  var userId = req.query.userId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/getUserActivePass@314",[userId,accountGroup],req.session.uid);
  DBController.getUserActivePass(userId,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getUserActivePass@317","Error 1.017",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.qrDocklessDropCheck = function(req,res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  var qrString = req.body.qrString;
  var userId = req.body.userId;
  var tripId = req.body.tripId;
  var userLat = req.body.userLat;
  var userLng = req.body.userLng;

  if(qrString === undefined || qrString.length === 0)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/qrDocklessDropCheck@342","Drop Off Error\n[QRDDC1_8_342]",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(tripId === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/qrDocklessDropCheck@249","Drop Off Error\n[QRDDC1_8_349]",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(userId === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/qrDocklessDropCheck@256","Drop Off Error\n[QRDDC1_8_356]",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  if(userLat === undefined || userLng === undefined || isNaN(userLat) || isNaN(userLng))
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/qrDocklessDropCheck@364","Drop Off Error\n[QRDDC1_8_364]",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/qrDocklessDropCheck@370",[userId,tripId,qrString,userLat,userLng,accountGroup],req.session.uid);
  
  TripController.qrDocklessDropCheck(userId,tripId,qrString,userLat,userLng,accountGroup).then(function(data){
    res.json(data);
  }).catch(function(err){
    if((err !== undefined || err != null) && err.status == "ERROR_DIST")
    {
      logger.catchFunc2(ip,"ERROR","/1.0/qrDocklessDropCheck@342","Drop Off Error\n[QRDDC1_8_377]",
        "Feature is currently in development. For more information, contact our customer support via in-app chat!",
        res,400,"https://ibb.co/k2zQzG");
    }
    else if((err !== undefined || err !== null) && err.status == "ERROR_QR")
    {
      logger.catchFunc2(ip,"ERROR","/1.0/qrDocklessDropCheck@348","QR Code Error\n[QRDDC1_8_383]",
        "Please scan TRYKE STATION QR to end trip!",
        res,400,"https://ibb.co/k2zQzG");
    }
    else if((err !== undefined || err !== null) && err.status == "ERROR_FAR")
    {
      logger.catchFunc2(ip,"ERROR","/1.0/qrDocklessDropCheck@354","QR Code Error\n[QRDDC1_8_389]",
        "Too far from scanned station! Please try again in close proximity.",
        res,400,"https://ibb.co/k2zQzG");
    }
    else {
      logger.catchFunc2(ip,"ERROR","/1.0/qrDocklessDropCheck@359","Drop Off Error\n[QRDDC1_8_394]",
        "There seems to be a problem in processing your request. Please try again!",
        res,400,"https://ibb.co/k2zQzG");
        console.log("ERROR@QrDocklessDropOffCheck : " + err);
    }
  });
}

exports.tripCompleted = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(req.query.userId === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/tripCompleted@407","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(req.query.tripId === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/tripCompleted@414","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(req.query.rating === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/tripCompleted@421","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(req.query.feedback === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/tripCompleted@428","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  var userId = req.query.userId;
  var tripId = req.query.tripId;
  var rating = req.query.rating;
  var feedback = req.query.feedback;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/tripCompleted@438",[userId,tripId,rating,feedback,accountGroup],req.session.uid);
  TripController.tripCompleted(userId,tripId,rating,feedback,accountGroup).then(function(data)
  {
    res.json(data);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/tripCompleted@443","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getCommon = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  const _userLat = req.query.userLat === undefined || isNaN(req.query.userLat) ? -1 : req.query.userLat;
  const _userLng = req.query.userLng === undefined || isNaN(req.query.userLng) ? -1 : req.query.userLng;

  logger.logAPICall(ip,"/1.0/getCommon@452",[accountGroup,_userLat,_userLng],req.session.uid);
  DBController.getCommon(_userLat,_userLng,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getCommon@459",[err]));
    logger.catchFunc2(ip,"ERROR","/1.0/getCommon@459","Error 1.04",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.setUserFCMToken = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const db = dbUtil.admin.database();
  var _FCMToken = req.body.FCMToken;
  var _userId = req.body.userId;

  if(!_FCMToken)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setUserFCMToken@512","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setUserFCMToken@519","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  const projectGroupRef = accountGroup === undefined || accountGroup === "NIL" ? 
    db.ref("ProjectGroups").child("Telepod") : db.ref("ProjectGroups").child(accountGroup);
  var _projectGroupObj = new projectGroupModel();
  var _FCMOpsObj = new FCMOpsModel();
  logger.logAPICall(ip,"/1.0/setUserFCMToken@529",[_FCMToken,_userId,accountGroup],req.session.uid);
  DBController.setUserOBJ(_userId,{"FCMToken":_FCMToken},accountGroup).then(function(data){
    return projectGroupRef.once("value");
  }).then(function(_projectGroupSnapshot){
    if(_projectGroupSnapshot.exists())
    {
      Object.assign(_projectGroupObj,_projectGroupSnapshot.val());
      if(_projectGroupObj.FCMGroupToken === "NIL")
      {//create
        return HardwareController.createFCMDeviceGroup(accountGroup,[_FCMToken]).then(function(_FCMResponse){
          Object.assign(_FCMOpsObj,_FCMResponse);
          Object.assign(_projectGroupObj,{
            "FCMGroupToken":_FCMOpsObj.notification_key
          });
          var _foundPass = (_projectGroupObj.FCMUserTokens).find(function(_regStr){
            return _regStr === _FCMToken;
          });
          if(_foundPass === undefined)
          {
            (_projectGroupObj.FCMUserTokens).push(_FCMToken);
          }
          return projectGroupRef.update(_projectGroupObj);
        }).catch(function(err){
          logger.log("error",logger.logErrorReport("ERROR_CREATEFCMGROUP",
          "/1.0/setUserFCMToken@553",[err]));
          return true
        });
      }
      else
      {
        return HardwareController.addFCMTokenToDeviceGroup(accountGroup,
          _projectGroupObj.FCMGroupToken,[_FCMToken]).then(function(_FCMResponse){
            Object.assign(_FCMOpsObj,_FCMResponse);
            Object.assign(_projectGroupObj,{
              "FCMGroupToken":_FCMOpsObj.notification_key
            });
            var _foundPass = (_projectGroupObj.FCMUserTokens).find(function(_regStr){
              return _regStr === _FCMToken;
            });
            if(_foundPass === undefined)
            {
              (_projectGroupObj.FCMUserTokens).push(_FCMToken);
            }
            return projectGroupRef.update(_projectGroupObj);
          }).catch(function(err){
            logger.log("error",logger.logErrorReport("ERROR_ADDFCMTOKEN","/1.0/setUserFCMToken@574",[err]));
            return true;
          })
      }
    }
    else
    {
      throw(logger.logErrorReport("ERROR","/1.0/setUserFCMToken@581",[]));
    }
  }).then(function(){
    res.json({"status":"OK"});
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/setUserFCMToken@526","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getBestScooters = function(req,res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(req.query.qr === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getBestScooters@597","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(req.query.userId === undefined || req.query.userId === "NIL")
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getBestScooters@604","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  try
  {
    const qrInput = req.query.qr;
    const userId = req.query.userId;
    const userLatInput = (req.query.userLat && !isNaN(req.query.userLat)) ? parseFloat(req.query.userLat) : -1;
    const userLngInput = (req.query.userLng && !isNaN(req.query.userLng)) ? parseFloat(req.query.userLng) : -1;
    const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;

    logger.logAPICall(ip,"/1.0/getBestScooters@618",[qrInput,userLatInput,userLngInput,userId,accountGroup],req.session.uid);
    TripController.getBestScooters(qrInput,userLatInput,userLngInput,userId,accountGroup).then(function(data)
    {
      res.json(data);
    }).catch(function(err){
      logger.catchFunc2(ip,"ERROR","/1.0/getBestScooters@623","Hang in there",
        "Feature is currently in development. For more information, contact our customer support via in-app chat!",
        res,400,"https://ibb.co/k2zQzG");
    });
  }
  catch(e)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/getBestScooters@630","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  }
}

exports.scooterReturned = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/scooterReturned@642","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  var userId = req.query.userId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;

  logger.logAPICall(ip,"/1.0/scooterReturned@651",[userId,accountGroup],req.session.uid);
  TripController.scooterReturned(userId,accountGroup).then(function(data)
  {
    res.json(data);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/scooterReturned@656","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getUserTrips = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getUserTrips@668","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  if(!req.query.type)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getUserTrips@676","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  var userId = req.query.userId;
  var type = req.query.type;
  var limit = req.query.limit && !isNaN(req.query.limit) ? parseInt(req.query.limit) : 100;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;

  logger.logAPICall(ip,"/1.0/getUserTrips@687",[userId,type,limit,accountGroup],req.session.uid);
  DBController.getUserTrips(userId,type,limit,accountGroup).then(function(data){
    res.json(data);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getUserTrips@691","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.sendRefund = function(req,res) {
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId){
      logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/sendRefund@127","Hang in there",
        "Feature is currently in development. For more information, contact our customer support via in-app chat!",
        res,400,"https://ibb.co/k2zQzG");
      return;
  }

  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/sendRefund@131",[req.query.userId,accountGroup],req.session.uid);
  DBController.sendRefund(req.query.userId,accountGroup).then(function(refundResp){
    res.json(refundResp);
  }).catch(function(objResp){
    logger.catchFunc2(ip,"ERROR","/1.0/sendRefund@159","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.updateTripImageUrl = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var imageURL = req.body.imageURL;
  var userId = req.body.userId;
  var tripId = req.body.tripId;

  if(!userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/updateTripImageUrl@727","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!imageURL)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/updateTripImageUrl@734","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!tripId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/updateTripImageUrl@741","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/updateTripImageUrl@747",[userId,tripId,imageURL,accountGroup],req.session.uid);
  DBController.updateTripImageUrl(userId,tripId,imageURL,accountGroup).then(function(data)
  {
    res.json(data);
  }).catch(function(err){
      logger.catchFunc2(ip,"ERROR","/1.0/updateTripImageUrl@752","Hang in there",
        "Feature is currently in development. For more information, contact our customer support via in-app chat!",
        res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getUserOBJForFrontEnd = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  const _contact = req.query.contact === undefined ? "NIL" : req.query.contact;
  const _userLat = req.query.userLat === undefined || isNaN(req.query.userLat) ? -1 : req.query.userLat;
  const _userLng = req.query.userLng === undefined || isNaN(req.query.userLng) ? -1 : req.query.userLng;
  const _userId = req.query.userId === undefined ? "NIL" :  req.query.userId;
  const _userFoundArr = _userLat === -1 && _userLng === -1 ? "NIL" : countryIso.get(_userLat, _userLng); 
  const _userFoundAt = _userFoundArr === "NIL" ? "NIL" : _userFoundArr[0];
  
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/getUserOBJForFrontEnd@774",[_contact,_userLat,_userLng,_userFoundAt,_userId,accountGroup],req.session.uid);
  if(_contact === "NIL" && _userId === "NIL"){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getUserOBJForFrontEnd@758","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  DBController.getUserOBJForFrontEnd(_contact,_userFoundAt,_userId,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getUserOBJForFrontEnd@766","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.twoFaReg = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _number = req.body.number;
  var _country = req.body.country;
  logger.logAPICall(ip,"/1.0/twoFaReg@832",[_number,_country],req.session.uid);
  if(_number === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/twoFaReg@835","2FA Error\n[TFR1_0_835]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(_country === undefined)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/twoFaReg@842","2FA Error\n[TFR1_0_842]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  _number = _number.replace(/-|\s/g,""); //remove spaces and hyphen, sanitization step
  var _phoneNumber = _country + _number;
  var _pinCode = keygen._({
    length: 4,
    numbers: true,
    chars:false
  });
  var _text = "TRYKE Key: "+_pinCode+". Valid for 1 minute. If you face any issue, feel free to contact our customer support via in-app chat."
  try {
    jwt.sign({
      country: _country,
      number: _number
    },_pinCode,{expiresIn:60},function(errsign,tokenGenerated){
      if(!errsign)
      {
        if(_country === "+1")//American number for SMS restriction
        {
          res.json({"status":"OK","requestId": tokenGenerated});
          nexmo.message.sendSms("12035809656", _phoneNumber, _text);
        }
        else
        {
          res.json({"status":"OK","requestId": tokenGenerated});
          nexmo.message.sendSms("TRYKE", _phoneNumber, _text);
        }
      }
      else
      {
        logger.catchFunc2(ip,"ERROR","/1.0/twoFaReg@896","2FA Error\n[TFR1_0_896]",
          "There seems to be a problem in processing your request. Please try again!",
          res,400,"https://ibb.co/k2zQzG");
      }
    });
  } catch (e) {
    logger.catchFunc2(ip,"ERROR","/1.0/twoFaReg@903","2FA Error\n[TFR1_0_903]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
  }
}
/* 
function sendPinEmail(_email,_pin)
{
  const transport = nodemailer.createTransport({
    host:"mail.telepod.sg",
    port:465,
    secure: true,
    auth: {
      user: telepodDetails.mail_user,//,
      pass: telepodDetails.mail_pass,
    }
  });
  logger.log("info",logger.logErrorReport("INFO","/1.0/sendEmail@234",[_email,_pin]));
  var mailOptions = {
    from: '"Telepod Marketing" <' + telepodDetails.mail_user + '>', // sender address
    to: _email, // list of receivers
    subject: 'Your Telepod pin code is here!', // Subject line
    html: 'Hi there, Your pin code is: <h2><centre>' +_pin+'</centre></h2><br><br>Enjoy your ride!<br><br>-The Telepod Team' // html body
  };
  transport.sendMail(mailOptions);
} */

exports.twoFaVer = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _userCountry = "SGP";
  var _userCurrency = "NIL";
  var _contact = "NIL";
  var _countryCode = "NIL";
  var _pin = req.body.pin;
  var _requestId = req.body.requestId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/twoFaVer@940",[_pin,_requestId,accountGroup],req.session.uid);
  if(!_pin)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/twoFaVer@943","2FA Verify Error\n[TFV1_0_943]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_requestId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/twoFaVer@950","2FA Verify Error\n[TFV1_0_950]",
      "There seems to be a problem in processing your request. Please try again!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  try {
    jwt.verify(_requestId,String(_pin),function(err,decoded){
      if(!err)
      {
        _contact = decoded.number;
        _countryCode = decoded.country;
        var _userFoundCountryObj = algorithm.getCountryObjects().find(function(e){
          return e.dialCode === _countryCode;
        }); //_country  === "+60" ? "MYS" : "SGP";
        _userCountry = _userFoundCountryObj !== undefined ? _userFoundCountryObj.country : "NIL";
        _userCurrency = _userFoundCountryObj !== undefined ? _userFoundCountryObj.currency : "NIL";

        DBController.getUsedUserContact(_contact,accountGroup).then(function(data){//check if user has account
          if(data !== null && data.length != 0)
          {// user objects are found....skip
            return data;
          }
          else{//else create...
            return DBController.createUser(_contact,_countryCode,_userCurrency,_userCountry,accountGroup).then(function(dataRev){
              var _arr = [];
              _arr.push(dataRev);
              return _arr;
            }).catch(function(e){
              throw(logger.logErrorReport("ERROR","/1.0/twoFaVer@980",
                [_pin,_requestId,accountGroup]));
            });
          }
        }).then(function(data){
          res.json(data);
        }).catch(function(e){
          logger.log("error",e);
          logger.catchFunc2(ip,"ERROR","/1.0/twoFaVer@988","2FA Verify Error\n[TFV1_0_988]",
            "There seems to be a problem in processing your request. Please try again",
            res,400,"https://ibb.co/k2zQzG");
        });
      }
      else
      {
          logger.catchFunc2(ip,"PIN_ERROR","/1.0/twoFaVer@995","2FA Verify Error\n[TFV1_0_995]",
            "There seems to be a problem in the provided pin code. Please try again!",
            res,400,"https://ibb.co/k2zQzG");
      }
    });
  } catch (e) {
    logger.catchFunc2(ip,"ERROR","/1.0/twoFaVer@1001","2FA Verify Error\n[TFV1_0_1001]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
  }
}

exports.findNumberUserObj = function(req,res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _number = req.query.number;
  if(!_number)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/findNumberUserObj@1013","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  _number = _number.replace(/-|\s/g,""); //remove spaces and hyphen, sanitization step
  logger.logAPICall(ip,"/1.0/findNumberUserObj@1020",[_number],req.session.uid);
  DBController.getUsedUserContact(_number,accountGroup).then(function(data){
    res.json(data);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/findNumberUserObj@1024","Hang in there",
      "Feature is currently in development. For more information, contact our customer support via in-app chat!",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.buzzScooter = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.scooterId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/buzzScooter@1284","Error 1.0_1207",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  logger.logAPICall(ip,"/1.0/buzzScooter@1290",[accountGroup,req.query.targetLocation],req.session.uid);
  HardwareController.buzzerOn(accountGroup,req.query.scooterId).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/buzzScooter@1294","Error 1.0_1217",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.swapScooter = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const _userId = req.body.userId;
  const _tripId = req.body.tripId;
  const _scooterId = req.body.scooterId;
  var _nowTime = new Date().getTime();
  var _tripStatus = "NIL";
  var _tripScooterId = "NIL";
  var _foundScooterStationId = "DST-SGHOST-01";
  var _foundScooterStationName = "NIL";
  if(!_userId || _userId == "NIL")
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/swapScooter@1236","Swap Scooter Error\n[PA1_0_1236]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_tripId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/swapScooter@1243","Swap Scooter Error\n[PA1_0_1243]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_scooterId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/swapScooter@1250","Swap Scooter Error\n[PA1_0_1250]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/swapScooter@1256",[_userId,_tripId,_scooterId,accountGroup],req.session.uid);
  DBController.getScooterOBJ(accountGroup,_scooterId).then(function(_scooterObj){
    _foundScooterStationId = _scooterObj.stationId;
    return DBController.getStationOBJ(_foundScooterStationId,accountGroup);
  }).then(function(_foundStationObj){
    _foundScooterStationName = _foundStationObj.stationName;
    return DBController.getTripObj(_userId,_tripId,accountGroup);
  }).then(function(_tripObj){
    _tripStatus = _tripObj.status;
    _tripScooterId = _tripObj.scooterId;
    _nowTime = _tripObj.bookingTime;
    if(_tripStatus === "TRIP_STARTED" || _tripStatus === "MULTI_TRIP_STARTED")
    {
      if(_tripScooterId === _scooterId)
      {
        throw(logger.logErrorReport("ERROR_SAME_SCOOTER","/1.0/swapScooter@1271",[_userId,_tripId,_scooterId]));
      }
      else
      {
        return db.removeTripQueue(_tripScooterId);
      }
    }
    else
    {
      throw(logger.logErrorReport("ERROR","/1.0/swapScooter@1280",[_userId,_tripId,_scooterId]));
    }
  }).then(function(){
    HardwareController.gpsLowRelayCommand(accountGroup,_tripScooterId);
    return DBController.setScooterOBJ(_tripScooterId,{"status":"Available","lastStatusChange":_nowTime,"action":-1,
    "lastUser":_userId,"lastSubmitted" : -1,"lastImg" : "NIL"});
  }).then(function(){
    return DBController.addTripQueue(_userId,_tripId,_scooterId,_foundScooterStationId,
      _foundScooterStationName,_foundScooterStationName,_tripStatus,_nowTime,accountGroup);
  }).then(function(){
    return DBController.setTripOBJ(_userId,_tripId,{"scooterId":_scooterId},accountGroup);
  }).then(function(){
    return DBController.setScooterOBJ(_scooterId,{"status":"InUse","lastStatusChange":_nowTime,"action":-1,
    "lastUser":_userId,"lastSubmitted" : -1,"lastImg" : "NIL"});
  }).then(function(){
    HardwareController.gpsHighRelayCommand(accountGroup,_scooterId);
    res.json({"status":"OK"});
  }).catch(function(err){
    if(err == null || err == undefined)
      {
        logger.catchFunc2(ip,"ERROR","/1.0/swapScooter@1302","Swap Scooter Error\n[1302]",
        "There seems to be a problem in processing your request. Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      }
      else if(err.status !== undefined && err.status == "ERROR_SAME_SCOOTER")
      {
        logger.catchFunc2(ip,"ERROR","/1.0/swapScooter@1308","Swap Scooter Error\n[1308]",
        "Cannot swap same scooter!",
        res,400,"https://ibb.co/k2zQzG");
      }
      else
      {
        logger.catchFunc2(ip,"ERROR","/1.0/swapScooter@1314","Swap Scooter Error\n[1314]",
        "There seems to be a problem in processing your request. Please try again!",
        res,400,"https://ibb.co/k2zQzG");
      }
  });
}

exports.setUserProfile = function(req,res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _email = req.body.email;
  var _name = req.body.name;
  var _userId = req.body.userId;

  if(!_userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setUserProfile@1330","Update Profile Error\n[SUP1_0_1330]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_name)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setUserProfile@1337","Update Profile Error\n[SUP1_0_1337]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_email)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setUserProfile@1344","Update Profile Error\n[SUP1_0_1344]",
      "There seems to be a problem in processing your request. Please try again",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/setUserProfile@1350",[_userId,_name,_email,accountGroup],req.session.uid);
  DBController.setUserOBJ(_userId,{"email":_email,"name":_name},accountGroup).then(function(data)
  {
    res.json(data);
  }).catch(function(err){
      logger.catchFunc2(ip,"ERROR","/1.0/setUserProfile@1355","Update Profile Error\n[SUP1_0_1355]",
        "There seems to be a problem in processing your request. Please try again!",
        res,400,"https://ibb.co/k2zQzG");
  });
}

exports.lightOff = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lightOff@1365","Error 1.0_1365",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(!req.query.scooterId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lightOff@1371","Error 1.0_1371",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var _userId = req.query.userId;
  var _scooterId = req.query.scooterId;
  logger.logAPICall(ip,"/1.0/lightOff@1378",[accountGroup,_userId,_scooterId],req.session.uid);
  HardwareController.gpsLightOff(accountGroup,_scooterId).then(function(){
    res.json({"status":"OK"});
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/lightOff@1382","Error 1.1382",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.lightOn = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lightOn@1392","Error 1.0_1392",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(!req.query.scooterId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lightOn@1398","Error 1.0_13987",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var _userId = req.query.userId;
  var _scooterId = req.query.scooterId;
  logger.logAPICall(ip,"/1.0/lightOn@1474",[accountGroup,_userId,_scooterId],req.session.uid);
  HardwareController.gpsLightOn(accountGroup,_scooterId).then(function(){
    res.json({"status":"OK"});
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/lightOn@1409","Error 1.1409",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getScootersInStation = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getScootersInStation@1419","Error 1.0_1419",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  if(!req.query.stationId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getScootersInStation@1425","Error 1.0_1425",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var _userId = req.query.userId;
  var _stationId = req.query.stationId;
  logger.logAPICall(ip,"/1.0/getScootersInStation@1432",[_userId,_stationId],req.session.uid);
  DBController.getScootersInStation(accountGroup,_stationId,"Available").then(function(scooterObjArr){
    res.json(scooterObjArr);
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/getScootersInStation@1436","Query Error\n[GSIS1_0_1436]",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.checkUserReferral = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/checkUserReferral@1482","Error 1.0_1482",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!req.query.refId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/checkUserReferral@1489","Error 1.0_1489",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  var _userId = req.query.userId;
  var _refId = req.query.refId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/checkUserReferral@1498",[_userId,_refId,accountGroup],req.session.uid);

  if(_userId === _refId)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/checkUserReferral@1502","Error 1.0_1502",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  DBController.checkUserReferral(_userId,_refId,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/checkUserReferral@1511","Error 1.0_1511",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.unlockScooter = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/unlockScooter@1553","Error 1.0_1553",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!req.query.scooterId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/unlockScooter@1560","Error 1.0_1560",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  var _userId = req.query.userId;
  var _scooterId = req.query.scooterId;

  logger.logAPICall(ip,"/1.0/unlockScooter@1569",[accountGroup,_userId,_scooterId],req.session.uid);
  HardwareController.gpsHighRelayCommand(accountGroup,_scooterId).then(function(){
    res.json({"status":"OK"});
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/unlockScooter@1573","Error 1.0_1573",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.lockScooter = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lockScooter@1584","Error 1.1584",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!req.query.scooterId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/lockScooter@1591","Error 1.1591",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  var _userId = req.query.userId;
  var _scooterId = req.query.scooterId;

  logger.logAPICall(ip,"/1.0/lockScooter@1600",[accountGroup,_userId,_scooterId],req.session.uid);
  HardwareController.gpsLowRelayCommand(accountGroup,_scooterId).then(function(){
    res.json({"status":"OK"});
  }).catch(function(e){
    logger.catchFunc2(ip,"ERROR","/1.0/lockScooter@1604","Error 1.1604",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.convertUserDepositToCredit = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/convertUserDepositToCredit@1615","Error 1.0_1615",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var _userId = req.query.userId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/convertUserDepositToCredit@1622",[_userId,accountGroup],req.session.uid);
  DBController.convertUserDepositToCredit(_userId,accountGroup).then(function(response){
    res.json(response);
  }).catch(function(error){
    logger.catchFunc2(ip,"ERROR","/1.0/convertUserDepositToCredit@1626","Error 1.0_1626",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.createScooterReport = function(req,res)
{
  const deferred = Q.defer();
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  var _userId = req.body.userId;
  var _scooterId = req.body.scooterId;
  var _locationUser = req.body.locationUser;
  var _message = req.body.message;
  var _typeOfIssue = parseInt(req.body.typeOfIssue);

  if(!_userId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createScooterReport@1644","Error 1.0_1644",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  if(!_scooterId)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createScooterReport@1651","Error 1.0_1651",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  if(!_locationUser)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createScooterReport@1659","Error 1.0_1659",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  if(!_message)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createScooterReport@1667","Error 1.0_1667",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }

  if(!_typeOfIssue)
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createScooterReport@1675","Error 1.0_1675",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/createScooterReport@1681",[_userId,_scooterId,_locationUser,_message,_typeOfIssue,accountGroup],req.session.uid);
  
  try{
    const db = dbUtil.admin.database();
    const nowTime = new Date().getTime();
    const scooterReportRef = accountGroup === undefined || accountGroup === "NIL" ? 
      db.ref("ScootersReports") : db.ref(accountGroup).child("ScootersReports");
    var _scooterReportObj = new ScooterReportModel();
    Object.assign(_scooterReportObj,{
      "userId":_userId,
      "scooterId":_scooterId,
      "locationUser":[_locationUser.latitude,_locationUser.longitude],
      "message":_message,
      "typeOfIssue":_typeOfIssue
    });
    scooterReportRef.child(nowTime).update(_scooterReportObj).then(function(){
      res.json({"status":"OK"});
      deferred.resolve;
    }).catch(function(err){
      logger.catchFunc2(ip,"ERROR","/1.0/createScooterReport@1705","Error 1.0_1705",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      deferred.reject;
    })

  }
  catch(e)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/createScooterReport@1686","Error 1.0_1686",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
    deferred.reject;
  }

  return deferred.promise;
}

exports.setRefundReasons = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var userId = req.body.userId;
  var reason = req.body.reason;
  var reason1 = req.body.reason1;
  var reason2 = req.body.reason2;

  if(!userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRefundReasons@1750","Error 1.0_1750",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!reason){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRefundReasons@1757","Error 1.0_1757",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!reason1){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRefundReasons@1764","Error 1.0_1764",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!reason2){
      logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRefundReasons@1771","Error 1.0_1771",
        "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
        res,400,"https://ibb.co/k2zQzG");
      return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/setRefundReasons@1777",[userId,reason,reason1,reason2,accountGroup],req.session.uid);
  var arrayToProcess = [reason,reason1,reason2];
  DBController.setRefundReasons(userId,arrayToProcess,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/setRefundReasons@1782","Error 1.0_1782",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.setRestoreId = function(req, res)
{
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var userId = req.body.userId + ""; //cast to string
  var restoreId = req.body.restoreId + ""; //cast to string

  if(!userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRestoreId@1795","Error 1.0_1795",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }

  if(!restoreId){
      logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/setRestoreId@1802","Error 1.0_1802",
        "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
        res,400,"https://ibb.co/k2zQzG");
      return;
  }
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/setRestoreId@1808",[userId,restoreId,accountGroup],req.session.uid);
  DBController.setUserOBJ(userId,{"restoreId":restoreId},accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/setRestoreId@1812","Error 1.0_1812",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getUserTransactions = function(req, res)
{
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if(!req.query.userId){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getUserTransactions@1822","Error 1.0_1821",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  var limit = req.query.limit && !isNaN(req.query.limit) ? parseInt(req.query.limit) : 100;
  var userId = req.query.userId;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/getUserTransactions@123",[userId,accountGroup],req.session.uid);
  DBController.getUserTransactions(userId,limit,accountGroup).then(function(result){
    res.json(result);
  }).catch(function(err){
    logger.catchFunc2(ip,"ERROR","/1.0/getUserTransactions@1834","Error 1.0_1834",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
  });
}

exports.getProjectPKey = function(req, res)
{
  const deferred = Q.defer();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  const _userId = req.query.userId === undefined ? "NIL" : req.query.userId;
  if(_userId === "NIL"){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/getProjectPKey@1571","Error 1.0_1571",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  logger.logAPICall(ip,"/1.0/getProjectPKey@1576",[_userId,accountGroup],req.session.uid);
  try
  {
    const db = dbUtil.admin.database();
    const commonRef = accountGroup === "NIL" ? db.ref("Common") :
      db.ref(accountGroup).child("Common");
    const userRef = accountGroup === "NIL" ? db.ref("Users") : 
      db.ref(accountGroup).child("Users");
    var _userObj = new userModel();
    var _commonObj = new commonModel();
    userRef.child(_userId).once("value").then(function(userSnapshot){
      if(!userSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/getProjectPKey@1589",[_userId,accountGroup]));
      }
      else
      {
        Object.assign(_userObj,userSnapshot.val());
        var _commonCountry = _userObj.country === "NIL" ? "DEF" : _userObj.country;
        return commonRef.child(_commonCountry).once("value");
      }
    }).then(function(commonSnapshot){
      if(!commonSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/getProjectPKey@1600",[_userId,_userObj.country,accountGroup]));
      }
      else
      {
        Object.assign(_commonObj,commonSnapshot.val());
        if(_commonObj.stripePublishKey === "NIL" || _commonObj.stripeSecretKey === "NIL")
        {
          logger.catchFunc2(ip,"ERROR_NIL_STRIPEKEY","/1.0/getProjectPKey@1607",
            "Stripe API Error\n[1608]",
            "There seems to be a problem in processing your request. Please try again",
            res,400,"https://ibb.co/k2zQzG");
          deferred.reject;
        }
        else
        {
          res.json({"stripePublishKey":_commonObj.stripePublishKey});
          deferred.resolve;
        }
      }
    }).catch(function(e){
      logger.log("error",e);
      logger.catchFunc2(ip,"ERROR","/1.0/getProjectPKey@1621","Stripe API Error\n[GPPK1_0_1621]",
        "There seems to be a problem in processing your request. Please try again",
        res,400,"https://ibb.co/k2zQzG");
      deferred.reject;
    });
  }
  catch(e){
    logger.log("error",e);
    logger.catchFunc2(ip,"ERROR","/1.0/getProjectPKey@1629","Error 1.1629",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    deferred.reject;
  }
  return deferred.promise;
}

exports.createPaymentIntent = function(req,res)
{
  //userId,creditCardToken,passId,paymentAmount,paymentType(Optional)
  // "0:DEPOSIT 1:CREDIT 2:REFUND 3:PASS 4:FINE-CREDIT 5:FINE-DEPOSIT 6:TRIP FARE"		
  const deferred = Q.defer();
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _userId = req.body.userId;
  var _creditCardToken = req.body.creditCardToken === undefined || !req.body.creditCardToken ||
    req.body.creditCardToken === "" ? "NIL" : req.body.creditCardToken
  var _passId = req.body.passId === undefined || !req.body.passId ||
    req.body.passId === "" ? "NIL" : req.body.passId
  var _paymentAmount = req.body.paymentAmount === undefined || !req.body.paymentAmount ||
    req.body.paymentAmount === "" || isNaN(req.body.paymentAmount) ? 0 : parseInt(req.body.paymentAmount);
  var _paymentType = req.body.paymentType === undefined || !req.body.paymentType ||
    req.body.paymentType === "" || isNaN(req.body.paymentType) ? 1 : parseInt(req.body.paymentAmount);

  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  logger.logAPICall(ip,"/1.0/createPaymentIntent@1757",[_userId,_creditCardToken,_passId,_paymentAmount,
    _paymentType,accountGroup],req.session.uid);
  

  if(_userId === undefined || !_userId || _userId === "")
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/createPaymentIntent@1785","Error 1.0_1785",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
    deferred.resolve;
  }
  if(_passId === "NIL" && _paymentAmount <= 0)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/createPaymentIntent@1792","Error 1.0_1792",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
    deferred.resolve;
  }

  try{
    var stripe;
    const db = dbUtil.admin.database();
    const commonRef = accountGroup === "NIL" ? db.ref("Common") :
      db.ref(accountGroup).child("Common");
    const userRef = accountGroup === "NIL" ? db.ref("Users") : 
      db.ref(accountGroup).child("Users");
    const transactionRef = accountGroup === "NIL" ? db.ref("Transactions") : 
      db.ref(accountGroup).child("Transactions");
    var passRef = accountGroup === undefined || accountGroup === "NIL" ? 
      db.ref("Marketing").child("Subscriptions") :
      db.ref(accountGroup).child("Subscriptions"); 

    var _userTransactionObj = new transactionModel();
    var _userObj = new userModel();
    var _userPaymentIntent = new paymentIntentModel();
    var _commonObj = new commonModel();
    var _userPassObj = new passModel();
    var _userPaymentMethod = new paymentMethodModel();

    userRef.child(_userId).once("value").then(function(userSnapshot){
      if(!userSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR_USER_NO_EXIST","/1.0/createPaymentIntent@1720",
          [_userId,accountGroup]));
      }
      else
      {
        Object.assign(_userObj,userSnapshot.val());
        if(_userObj.creditCardToken === "NIL" && _creditCardToken === "NIL")
        {//means no available creditToken...throw
          throw(logger.logErrorReport("ERROR_USER_NO_CCTOKEN","/1.0/createPaymentIntent@1829",
            [_userId,accountGroup]));
        }
        else
        {
          var _commonCountry = _userObj.country === "NIL" ? "DEF" : _userObj.country;
          return commonRef.child(_commonCountry).once("value");
        }
      }
    }).then(function(commonSnapshot){
      if(!commonSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR_COMMON_NO_EXIST","/1.0/createPaymentIntent@1720",
        [_userId,_userObj.country,accountGroup]));
      }
      else
      {
        Object.assign(_commonObj,commonSnapshot.val());
        if(_commonObj.stripeSecretKey === "NIL" || _commonObj.stripePublishKey === "NIL")
        {
          throw(logger.logErrorReport("ERROR_NIL_STRIPEKEY","/1.0/createPaymentIntent@1720",
          [_userId,_userObj.country,accountGroup]));
        }
        else if(_userObj.currency === "NIL" || _userObj.country === "NIL")
        {
          throw(logger.logErrorReport("ERROR_NIL_USERCOUNTRY","/1.0/createPaymentIntent@1720",
          [_userId,_userObj.country,accountGroup]));
        }
        else
        {
          stripe = require("stripe")(_commonObj.stripeSecretKey);
          if(_userObj.customerId === "NIL")
          {
            //if NIL create customer object
            return stripe.customers.create(
            {
              phone:_userObj.contact,
              metadata:{
                "userId":_userId
              }
            });
          }
          else
          {
            //else fetch customer object
            return stripe.customers.retrieve(_userObj.customerId);
          }
        }
      }
    }).then(function(_customerObj){
      Object.assign(_userObj,{"customerId":_customerObj.id});
      Object.assign(_userTransactionObj,{"country":_userObj.country,"currency":_userObj.currency})
      if(_passId === "NIL" && _paymentAmount <= 0)
      {
        throw(logger.logErrorReport("ERROR_PAYMENTAMOUNT","/1.0/createPaymentIntent@1875",
          [_userId,_paymentAmount,accountGroup]));
      }
      return passRef.child(_passId).once("value");
    }).then(function(passSnapshot){
      if(passSnapshot.exists())
      {
        Object.assign(_userPassObj,passSnapshot.val())
      }
      return stripe.paymentIntents.create({
        description: _passId !== "NIL" ? "Pass purchasal " + _passId : "Credit/Deposit Purchasal",
        amount: _passId !== "NIL" ? _userPassObj.costPrice : _paymentAmount,
        customer: _userObj.customerId,
        currency: _userObj.currency,
        payment_method: _userObj.creditCardToken !== "NIL" ? _userObj.creditCardToken : _creditCardToken,
        confirm: true,
        metadata:{
          "userId":_userId
        }
      });    
    }).then(function(_paymentIntentObj){
      Object.assign(_userPaymentIntent,_paymentIntentObj);
      if(_userPaymentIntent.status === "succeeded")
      {
        //fetch the payment method object here
        return stripe.paymentMethods.retrieve(_userPaymentIntent.payment_method).catch(function(e){
          logger.log("info",logger.logErrorReport("ERROR","/1.0/createPaymentIntent@1926",[e]));
          return true;
        });
      }
      else
      {
        throw(logger.logErrorReport("ERROR_PAYMENT","/1.0/createPaymentIntent@1928",
          [_userId,_userPaymentIntent.status,accountGroup]));
      }
    }).then(function(_paymentMethod){
      Object.assign(_userPaymentMethod,_paymentMethod);
      Object.assign(_userObj,{
        "credits" : _passId !== "NIL" ? _userObj.credits : _userObj.credits + _paymentAmount,
        "creditCardToken":_userPaymentIntent.payment_method,
        "creditCardType":_paymentMethod.card.brand,
        "creditCardNumber":_paymentMethod.card.last4,
        "creditCardUID":_paymentMethod.card.fingerprint
      });
      return userRef.child(_userId).update(_userObj);
    }).then(function(){
      Object.assign(_userTransactionObj,{
        "creditCardToken":_userObj.creditCardToken,
        "creditCardType":_userObj.creditCardType,
        "creditCardNumber":_userObj.creditCardNumber,
        "hasExpired":false,
        "passId":_passId,
        "passLevel":_userPassObj.passLevel,
        "paymentAmount":_passId !== "NIL" ? _userPassObj.costPrice : _paymentAmount,
        "paymentType": _passId !== "NIL" ? 3 : 1
      })
      return transactionRef.child(_userId).child(_userPaymentIntent.id).update(_userTransactionObj);
    }).then(function(){
      res.json({"status":"OK"})
      deferred.resolve;
    }).catch(function(e){
      logger.log("error",e);
      logger.catchFunc2(ip,"ERROR","/1.0/createPaymentIntent@1962","Stripe API Error\n[GPPK1_0_1962]",
        "There seems to be a problem in processing your request. Please try again data received: " + _userTransactionObj,
        res,400,"https://ibb.co/k2zQzG");
      deferred.reject;
    })
  }
  catch(e)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/createPaymentIntent@1970","Error 1.1970",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
  deferred.reject;
  }
  return deferred.promise;
}

exports.authenticatePaymentIntent = function(req,res)
{
  // userId,paymentMethodId
  const deferred = Q.defer();
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var _userId = req.body.userId;
  var _creditCardToken = req.body.creditCardToken;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;

  if(_creditCardToken === undefined || _creditCardToken === "NIL")
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/authenticatePaymentIntent@1907","Error 1.0_1907",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
    deferred.resolve();
  }

  if(_userId === undefined || _userId === "NIL")
  {
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/authenticatePaymentIntent@1915","Error 1.0_1915",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
    deferred.resolve;
  }
  logger.logAPICall(ip,"/1.0/authenticatePaymentIntent@1920",[_userId,_creditCardToken,accountGroup],
    req.session.uid);
  try{
    var stripe;
    const db = dbUtil.admin.database();
    const commonRef = accountGroup === "NIL" ? db.ref("Common") :
      db.ref(accountGroup).child("Common");
    const userRef = accountGroup === "NIL" ? db.ref("Users") : 
      db.ref(accountGroup).child("Users");

    var _userObj = new userModel();
    var _commonObj = new commonModel();
    var _userPaymentIntent = new paymentIntentModel();
    var _userPaymentMethod = new paymentMethodModel();

    userRef.child(_userId).once("value").then(function(userSnapshot){
      if(!userSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR_USER_NO_EXIST","/1.0/authenticatePaymentIntent@1929",
        [_userId,_creditCardToken,accountGroup]));
      }
      else
      {
        Object.assign(_userObj,userSnapshot.val());
        var _commonCountry = _userObj.country === "NIL" ? "DEF" : _userObj.country;
        return commonRef.child(_commonCountry).once("value");
      }
    }).then(function(commonSnapshot){
      if(!commonSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR_COMMON_NO_EXIST","/1.0/authenticatePaymentIntent@1940",
        [_userId,_userObj.country,accountGroup]));
      }
      else
      {
        Object.assign(_commonObj,commonSnapshot.val());
        if(_commonObj.stripeSecretKey === "NIL" || _commonObj.stripePublishKey === "NIL")
        {
          throw(logger.logErrorReport("ERROR_NIL_STRIPEKEY","/1.0/authenticatePaymentIntent@1948",
          [_userId,_userObj.country,accountGroup]));
        }
        else if(_userObj.currency === "NIL" || _userObj.country === "NIL")
        {
          throw(logger.logErrorReport("ERROR_NIL_USERCOUNTRY","/1.0/authenticatePaymentIntent@1953",
          [_userId,_userObj.country,accountGroup]));
        }
        else
        {
          stripe = require("stripe")(_commonObj.stripeSecretKey);
          if(_userObj.customerId === "NIL")
          {
            //if NIL create customer object
            return stripe.customers.create(
            {
              phone:_userObj.contact,
              metadata:{
                "userId":_userId
              }
            });
          }
          else
          {
            //else fetch customer object
            return stripe.customers.retrieve(_userObj.customerId);
          }
        }
      }
    }).then(function(_customerObj){
      Object.assign(_userObj,{"customerId":_customerObj.id});

        return stripe.paymentIntents.create({
          description:"Customer credit card authentication",
          amount: _commonObj.stripeAuthAmount,
          customer: _customerObj.id,
          currency: _userObj.currency,
          payment_method: _creditCardToken,
          confirm:true,
          capture_method:"manual",
          setup_future_usage: "off_session",
          metadata:{
            "userId":_userId
          }
        }).catch(function(_paymentErr){
          throw(logger.logErrorReport("ERROR_STRIPE_CONFIRMATION","/1.0/authenticatePaymentIntent@1991",
          [_userId,_userObj.country,_paymentErr.decline_code,accountGroup]));
        });     
    }).then(function(_paymentIntentObj){
      Object.assign(_userPaymentIntent,_paymentIntentObj);
      if(_userPaymentIntent.status !== "requires_capture")
      {
        throw(logger.logErrorReport("ERROR_STRIPE_STATUS","/1.0/authenticatePaymentIntent@1991",
        [_userId,_userObj.country,_userPaymentIntent.status,accountGroup]));
      }
      else
      {
        return stripe.paymentIntents.cancel(_userPaymentIntent.id).catch(function(e){
          logger.log("info",logger.logErrorReport("ERROR","/1.0/authenticatePaymentIntent@2014",[e]));
          return true;
        });
      }
    }).then(function(){
      return stripe.paymentMethods.retrieve(_creditCardToken).catch(function(e){
        logger.log("info",logger.logErrorReport("ERROR","/1.0/authenticatePaymentIntent@2020",[e]));
        return true;
      });
    }).then(function(_paymentMethod){
      Object.assign(_userPaymentMethod,_paymentMethod);
      Object.assign(_userObj,{
        "creditCardToken":_creditCardToken,
        "creditCardType":_paymentMethod.card.brand,
        "creditCardNumber":_paymentMethod.card.last4,
        "creditCardUID":_paymentMethod.card.fingerprint
      });
      return userRef.child(_userId).update(_userObj).catch(function(){
        return true;
      });
    }).then(function(){
      res.json({"status":"OK"});
      deferred.resolve;
    }).catch(function(e){
      logger.log("error",e);
      logger.catchFunc2(ip,"ERROR","/1.0/authenticatePaymentIntent@1732","Stripe API Error\n[GPPK1_0_1732]",
        "There seems to be a problem in processing your request. Please try again",
        res,400,"https://ibb.co/k2zQzG");
      deferred.reject;
    })
  }
  catch(e)
  {
    logger.catchFunc2(ip,"ERROR","/1.0/authenticatePaymentIntent@1739","Error 1.1739",
    "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
    res,400,"https://ibb.co/k2zQzG");
  deferred.reject;
  }

  return deferred.promise;
}

exports.removeCC = function(req, res)
{
  const deferred = Q.defer();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const accountGroup = req.session.accountGroup === undefined ? "NIL" : req.session.accountGroup;
  const _userId = req.query.userId === undefined ? "NIL" : req.query.userId;
  if(_userId === "NIL"){
    logger.catchFunc2(ip,"ERROR_MIS_PARM","/1.0/removeCC@2130","Error 1.0_2130",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
      return;
  }
  logger.logAPICall(ip,"/1.0/removeCC@2135",[_userId,accountGroup],req.session.uid);
  try
  {
    const db = dbUtil.admin.database();
    var stripe;
    const commonRef = accountGroup === "NIL" ? db.ref("Common") :
      db.ref(accountGroup).child("Common");
    const userRef = accountGroup === "NIL" ? db.ref("Users") : 
      db.ref(accountGroup).child("Users");
    var _userObj = new userModel();
    var _commonObj = new commonModel();
    userRef.child(_userId).once("value").then(function(userSnapshot){
      if(!userSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/removeCC@2148",[_userId,accountGroup]));
      }
      else
      {
        Object.assign(_userObj,userSnapshot.val());
        var _commonCountry = _userObj.country === "NIL" ? "DEF" : _userObj.country;
        return commonRef.child(_commonCountry).once("value");
      }
    }).then(function(commonSnapshot){
      if(!commonSnapshot.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/removeCC@2159",[_userId,_userObj.country,accountGroup]));
      }
      else
      {
        Object.assign(_commonObj,commonSnapshot.val());
        if(_commonObj.stripePublishKey === "NIL" || _commonObj.stripeSecretKey === "NIL")
        {
          logger.catchFunc2(ip,"ERROR_NIL_STRIPEKEY","/1.0/removeCC@2166",
            "Stripe API Error\n[GPPK1_0_1732]",
            "There seems to be a problem in processing your request. Please try again",
            res,400,"https://ibb.co/k2zQzG");
          deferred.reject;
        }
        else
        {
          stripe = require("stripe")(_commonObj.stripeSecretKey);
          return stripe.paymentMethods.detach(_userObj.creditCardToken).catch(function(e){
            return true;
          })
        }
      }
    }).then(function(){
      //update user
      Object.assign(_userObj,{
        "creditCardNumber":"NIL",
        "creditCardToken":"NIL",
        "creditCardType":"NIL",
        "creditCardUID":"NIL"
      });
      return userRef.child(_userId).update(_userObj);
    }).then(function(){
      res.json({"status":"OK"});
      deferred.resolve;
    }).catch(function(e){
      logger.log("error",e);
      logger.catchFunc2(ip,"ERROR","/1.0/removeCC@2180","Stripe API Error\n[RCC1_0_2180]",
        "There seems to be a problem in processing your request. Please try again",
        res,400,"https://ibb.co/k2zQzG");
      deferred.reject;
    });
  }
  catch(e){
    logger.log("error",e);
    logger.catchFunc2(ip,"ERROR","/1.0/removeCC@2188","Error 1.2188",
      "There seems to be an issue with your request.Contact TRYKE customer support for more information.",
      res,400,"https://ibb.co/k2zQzG");
    deferred.reject;
  }
  return deferred.promise;
}