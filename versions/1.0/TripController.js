var Q = require('q');
var telepodDetails = app_require('telepod_details');
var algorithm = app_require('util/Algorithm.js');
var dbUtil = app_require('util/DBUtil.js');
var logger = app_require('util/loggerUtil.js');

const shortUUID = require('short-uuid');

const tripModel = app_require('versions/1.0/Model/Trip.js');
const gpsModel = app_require('versions/1.0/Model/GPS.js');
const userModel = app_require('versions/1.0/Model/User.js');
const stationModel = app_require('versions/1.0/Model/Station.js');
const zoneModel = app_require('versions/1.0/Model/Zone.js');
const transactionModel = app_require('versions/1.0/Model/Transaction.js');
const passModel = app_require('versions/1.0/Model/Pass.js');
const commonModel = app_require('versions/1.0/Model/Common.js');
const paymentMethodModel = app_require('versions/1.0/Model/PaymentMethod.js');
const paymentIntentModel = app_require('versions/1.0/Model/PaymentIntent.js'); 

// MySQL Imports 
const conn = app_require('util/Sql.js');
const mysql = require('mysql');
// MySQL Imports

var hardware = app_require('versions/1.0/AppHardwareController.js');
var dbController = app_require('versions/1.0/DBController.js');

exports.quickBook = function(userId,scooterId,stationId,userLat,userLng,userPaymentType,
  userSaveCreditCard,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const db3 = dbUtil.admin3.database();
  var _gpsObj = new gpsModel();
  var _userObj = new userModel();
  var _stationObj = new stationModel();
  var _zoneObj = new zoneModel();
  var _previousTripObj = new tripModel();
  var _tripObj = new tripModel();

  const tripRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Trips").child(userId) : db.ref(_accountGroup).child("Trips").child(userId);
  const usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Users").child(userId) : db.ref(_accountGroup).child("Users").child(userId);
  const tripQueueRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Queue").child(scooterId) : db.ref(_accountGroup).child("Queue").child(scooterId);
  const zoneRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db3.ref("Zone") : db3.ref(_accountGroup).child("Zone");

  var userHasCreditsAndDeposit = false;
  var userPassTransactionId = "NIL";
  var bookingTime = new Date().getTime();
  var tripId = shortUUID.generate();

  var fScooterBattery;

  var promises = [tripRef.orderByChild("bookingTime").limitToLast(1).once("value"),
    usersRef.once("value"),
    dbController.getStationOBJ(stationId,_accountGroup),
    dbController.getScooterOBJ(_accountGroup,scooterId),
    tripQueueRef.once("value")];

    Q.all(promises).then(function(tell){
      if(!tell[1].exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/quickBook@58",[userId,scooterId,stationId,userLat,
          userLng,userPaymentType,userSaveCreditCard]));
      }
      var _previousTripId = tell[0].exists() ? Object.keys(tell[0].val())[0] : "NIL";
      Object.assign(_previousTripObj,{
        "tripId": _previousTripId,
        "status": _previousTripId !== "NIL" && tell[0].child(_previousTripId).child("status").exists()
          ? tell[0].val()[_previousTripId]["status"] : "EXPIRED",
        "tripRefId": _previousTripId !== "NIL" && tell[0].child(_previousTripId).child("tripRefId").exists()
          ? tell[0].val()[_previousTripId]["tripRefId"] : "NIL"
      });

      Object.assign(_userObj,tell[1].val());

      userHasCreditsAndDeposit = _userObj.credits >= 0 ? true:false;

      Object.assign(_stationObj,tell[2]);

      Object.assign(_gpsObj,tell[3]);
      fScooterBattery = parseFloat(algorithm.map_range(_gpsObj.Battery,31,42,0,100));

      Object.assign(_zoneObj,{"zoneId":"NIL"});
      if(tell[4].exists())
      {
        throw(logger.logErrorReport("ERROR_INUSE","/1.0/quickBook@82",[userId,scooterId,stationId,userLat,
          userLng,userPaymentType]));
      }
      else if(_stationObj.zoneId !== "NIL")
      {
        return zoneRef.child(_stationObj.zoneId).once("value").then(function(_zoneObjRecv){
          if(_zoneObjRecv.exists())
          {
            Object.assign(_zoneObj,_zoneObjRecv.val(),{"zoneId":_zoneObjRecv.ref.key});
            return _zoneObj;
          }
          else
          {
            return _zoneObj;
          }
        }).catch(function(e){
          return _zoneObj;
        });
      }
      else
      {
        throw(logger.logErrorReport("ERROR_ZONE_SUSPENDED","/1.0/quickBook@103",[userId,scooterId,stationId,
          userLat,userLng,userPaymentType]));
      }
    }).then(function(){
      
      if(_zoneObj.isSuspended || _zoneObj.zoneId === "NIL")
      {
        throw(logger.logErrorReport("ERROR_ZONE_SUSPENDED","/1.0/quickBook@110",[userId,scooterId,stationId,
          userLat,userLng,userPaymentType,_zoneObj.isSuspended,_zoneObj.zoneId]));
      }
      else if(_gpsObj.status !== "Available" && _gpsObj.status !== "LTD")
      {
        throw(logger.logErrorReport("ERROR","/1.0/quickBook@115",[userId,scooterId,stationId,userLat,
          userLng,userPaymentType,_gpsObj.status]));
      }
      else if((fScooterBattery >= 35) &&
              ((_previousTripObj.status === "TRIP_STARTED") || (_previousTripObj.status === "MULTI_TRIP_STARTED") ||
              (_previousTripObj.status === "CANCELLED") || (_previousTripObj.status === "EXPIRED")  ||
              (_previousTripObj.status === "DROPOFF_RETURNED") || (_previousTripObj.status === "DROPOFF_COMPLETION") ||
              (_previousTripObj.status === "COMPLETED")))
      {  
        return dbController.getUserActivePass(userId,_accountGroup).catch(function(){
          return [];
        });
      }
      else
      {
        throw(logger.logErrorReport("ERROR","/1.0/quickBook@130",[userId,scooterId,fScooterBattery,
          stationId,userLat,userLng,userPaymentType]));
      }
    }).then(function(userPass){
      if(userPass.length > 0 || userHasCreditsAndDeposit || userPaymentType === "creditCard")
      {
        userPassTransactionId = userPass.length !== 0 ? userPass[0].transactionId : "NIL";
        return true;
      }
      else {
        throw(logger.logErrorReport("ERROR_BAL","/1.0/quickBook@129",[userId,scooterId,stationId,userLat,
          userLng,userPaymentType]));
      }
    }).then(function(){
      Object.assign(_tripObj,{
        "scooterId" : scooterId,
        "IMEI": _gpsObj.IMEI,
        "passTransactionId" : userPassTransactionId,
        "bookingTime": bookingTime,
        "status": _previousTripObj.status === "TRIP_STARTED" ? "MULTI_TRIP_STARTED" :
          _previousTripObj.status === "MULTI_TRIP_STARTED" ? "MULTI_TRIP_STARTED" : "TRIP_STARTED",
        "tripRefId": _previousTripObj.status === "TRIP_STARTED" ? _previousTripObj.tripRefId :
          _previousTripObj.status == "MULTI_TRIP_STARTED" ? _previousTripObj.tripRefId : tripId,
        "saveCreditCard": userSaveCreditCard,
        "isMultiTrip": _previousTripObj.status === "TRIP_STARTED" ? true :
          _previousTripObj.status == "MULTI_TRIP_STARTED" ? true : false,
        "paymentType": userPaymentType,
        "userLocationAtBooking": [parseFloat(userLat),parseFloat(userLng)],
        "pickUpZoneFare": _zoneObj.zoneFare,
        "pickUpZoneTimeBlock": _zoneObj.zoneTimeBlock,
        "pickUpTime":bookingTime,
        "pickUpZoneId":_zoneObj.zoneId,
        "pickUpStationId":stationId,
        "pickUpStationName":_stationObj.stationName,
        "etcFare":_zoneObj.zoneUnlockFare
      });

      var tempStatus = _previousTripObj.status === "TRIP_STARTED" ? "MULTI_TRIP_STARTED" :
        _previousTripObj.status == "MULTI_TRIP_STARTED" ? "MULTI_TRIP_STARTED" : "TRIP_STARTED";
      return dbController.addTripQueue(userId,tripId,scooterId,stationId,_stationObj.stationName,
        _stationObj.stationName,tempStatus,bookingTime,_accountGroup);
    }).then(function(){
      return dbController.setGPSOBJ(_gpsObj.IMEI,{"status":"InUse","lastStatusChange":bookingTime,"action":-1,
        "lastUser":userId,"lastSubmitted" : -1,"lastImg" : "NIL"});
    }).then(function(){
      return dbController.setTripOBJ(userId,tripId,_tripObj,_accountGroup);
    }).then(function(){
      return dbController.setStationOBJ(stationId,{"scooterAvail":--_stationObj.scooterAvail},_accountGroup);
    }).then(function(){
      hardware.gpsHighRelayCommand(_accountGroup,scooterId);
      return true;
    }).then(function(){
      Object.assign(_tripObj,{
        "tripId":tripId,
      });
      deferred.resolve(_tripObj);
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/quickBook@665",[err]));
      deferred.reject(err);
    });
    return deferred.promise;
}

exports.qrDocklessDropCheck = function(userId,userTripId,qrString,userLat,userLng,_accountGroup)
{
  const deferred = Q.defer();
  var stripe;
  const db = dbUtil.admin.database();
  const commonRef = _accountGroup === "NIL" ? db.ref("Common") :
    db.ref(_accountGroup).child("Common");
  const transactionRef = _accountGroup === "NIL" ? db.ref("Transactions") : 
    db.ref(_accountGroup).child("Transactions");

  var _commonObj = new commonModel();
  var _userTripObj = new tripModel();
  var _userObj = new userModel();
  var _userDropOffStation = new stationModel();
  var _gpsObj = new gpsModel();
  var _userTransactionObj = new transactionModel();
  var _userPassObj = new passModel();
  var _userPaymentMethod = new paymentMethodModel();
  var _userPaymentIntent = new paymentIntentModel();

  var dropOffStationId;
  var dropOffZoneId;
  var dropOffIsExclusive=false;
  var dropOffStationRadius = 400;
  var dropOffStationName = "NIL";
  var dropOffZoneUnlockFare = 0;
  var pickUpZoneId;
  var pickUpZoneFare = 15;
  var pickUpZoneTimeBlock = 60;
  var pickUpIsExclusive = false;

  var isQRStation = false;
  var isQRScooter = false;
  var isUserInOperatingZone = true;
  var isUserWithinStation = true;

  const returnTime = new Date().getTime();
  var totalFare = 0;
  var etcFare = 0;
  var totalTime = 0;
  var scooterTotalUsageTime = 0;
  const _userLocationAtDropOff = [parseFloat(userLat),parseFloat(userLng)];
  var promises = [dbController.getTripObj(userId,userTripId,_accountGroup),
    dbController.getUserOBJ(userId,_accountGroup)];

  Q.all(promises).then(function(tell){
    Object.assign(_userTripObj,tell[0]);
    totalTime = parseInt(returnTime - _userTripObj.pickUpTime) <= 0 ? 0 :
                  parseInt(returnTime - _userTripObj.pickUpTime);

    Object.assign(_userObj,tell[1],{
      "totalRideSecs": (tell[1].totalRideSecs+totalTime),
      "tripCount": ++tell[1].tripCount,
      "statusCode": tell[1].statusCode & 0xFE
    });

    if(_userTripObj.status === "DROPOFF_RETURNED" || _userTripObj.status === "DROPOFF_COMPLETION")
    {
      deferred.resolve({"status":"OK"});
    }
    else if(_userTripObj.status !== "TRIP_STARTED" && _userTripObj.status !== "MULTI_TRIP_STARTED")
    {
      throw(logger.logErrorReport("ERROR","/1.0/qrDocklessDropCheck@292",
        [userId,userTripId,qrString,userLat,userLng]));
    }
    else {
      //Check scanned QR is station..
      return dbController.getStationOBJ(qrString,_accountGroup).then(function(dropOffStationOBJ){
        Object.assign(_userDropOffStation,dropOffStationOBJ,{"stationId":qrString});
        isQRStation = true;
        return true;
      }).catch(function(e){
        isQRStation = false;
        return true;
      });
    }
  }).then(function(){
    //Check scanned QR is scooter
    return dbController.getScooterOBJ(_accountGroup,qrString).then(function(_gpsObjRecv){
      scooterTotalUsageTime = _gpsObjRecv.totalUsageTime + totalTime;
      Object.assign(_gpsObj,_gpsObjRecv,{"totalUsageTime":scooterTotalUsageTime});
      isQRScooter = true;
      return true;
    }).catch(function(e){
      isQRScooter = false;
      return dbController.getScooterOBJ(_accountGroup,_userTripObj.scooterId).then(function(_gpsObjRecv){
        Object.assign(_gpsObj,_gpsObjRecv,{"totalUsageTime":scooterTotalUsageTime});
        return true;
      }).catch(function(err){
        return true;
      });
    });
  }).then(function(){
    if(!isQRScooter && !isQRStation)
    {
      throw(logger.logErrorReport("ERROR_QR","/1.0/qrDocklessDropCheck@329",
        [userId,userTripId,qrString,userLat,userLng]));
    }
    const _scooterToStationDist = algorithm.GPSMeasureDistance(_gpsObj.lat, _gpsObj.lng,
      _userDropOffStation.l[0], _userDropOffStation.l[1]);
    const _userToStationDist = algorithm.GPSMeasureDistance(userLat, userLng,
      _userDropOffStation.l[0], _userDropOffStation.l[1]);
      dropOffStationRadius = _userDropOffStation.geofenceRadiusM;
    if(_userToStationDist <= dropOffStationRadius || _scooterToStationDist <= dropOffStationRadius)
    {
      return dbController.getUserTransactionObj(userId,_userTripObj.passTransactionId,_accountGroup)
      .catch(function(err){
        logger.log("info",logger.logErrorReport("ERROR_NOT_FOUND",
        "/1.0/CountryControllers/SGPControllers/qrDocklessDropCheck@108",
          [userId,_userTripObj.passTransactionId]));
        return {};
      });
    }
    else
    {
      throw(logger.logErrorReport("ERROR_FAR","/1.0/qrDocklessDropCheck@350",
      [userId,userTripId,qrString,userLat,userLng,_userToStationDist,_scooterToStationDist, dropOffStationRadius]));
    }
  }).then(function(useractivearray){ //for trip with passes
    if(useractivearray.passId !== undefined)
    {
      Object.assign(_userTransactionObj,useractivearray);
      return dbController.getPassOBJ(_userTransactionObj.passId,_accountGroup).then(function(passObj){
        Object.assign(_userPassObj,passObj);
        return true;
      }).catch(function(err){
        return true;
      });
    }
    else {
      return true;
    }
  }).then(function(){ // check user's location to found station.
    dropOffStationName = isQRStation ? _userDropOffStation.stationName : _userTripObj.pickUpStationName;
    dropOffStationId = isQRStation ? _userDropOffStation.stationId : _userTripObj.pickUpStationId;
    return dbController.getZoneOBJ(_accountGroup,_userTripObj.pickUpZoneId).then(function(_zoneObjRecv){
      var _zoneObjRecvTemp = new zoneModel();
      Object.assign(_zoneObjRecvTemp,_zoneObjRecv,{"zoneId":_userTripObj.pickUpZoneId});
      return _zoneObjRecvTemp;
    });
  }).then(function(pickUpZoneOBJ){
    pickUpZoneId = pickUpZoneOBJ.zoneId !== "NIL" ? pickUpZoneOBJ.zoneId : _userTripObj.pickUpZoneId;
    pickUpZoneFare = pickUpZoneOBJ.zoneId !== "NIL" ? pickUpZoneOBJ.zoneFare : _userTripObj.pickUpZoneFare;
    pickUpZoneTimeBlock = pickUpZoneOBJ.zoneId !== "NIL" ? pickUpZoneOBJ.zoneTimeBlock : _userTripObj.pickUpZoneTimeBlock;
    pickUpIsExclusive = pickUpZoneOBJ.zoneId !== "NIL" ? pickUpZoneOBJ.isExclusive : false;
    if(isQRStation)
    {
      return dbController.getZoneOBJ(_accountGroup,_userDropOffStation.zoneId).then(function(_zoneObjRecv){
        var _zoneObjRecvTemp = new zoneModel();
        Object.assign(_zoneObjRecvTemp,_zoneObjRecv,{"zoneId":_userDropOffStation.zoneId});
        return _zoneObjRecvTemp;
      });
    }
    else
    {
      var _zoneObjRecvTemp = new zoneModel();
      return _zoneObjRecvTemp;
    }
  }).then(function(dropOffZoneOBJ){
    dropOffZoneId = dropOffZoneOBJ.zoneId !== "NIL" ? dropOffZoneOBJ.zoneId : _userTripObj.pickUpZoneId;
    dropOffIsExclusive = dropOffZoneOBJ.zoneId !== "NIL" ? dropOffZoneOBJ.isExclusive : false;
    dropOffZoneUnlockFare = dropOffZoneOBJ.zoneUnlockFare;

    if((pickUpIsExclusive) && (pickUpZoneId !== dropOffZoneId))
    {
      throw(logger.logErrorReport("ERROR_DIST","/1.0/CountryControllers/SGPControllers/qrDocklessDropCheck@247",
        [userId,userTripId,qrString,userLat,userLng,dropOffStationId]));
    }
    else if((!pickUpIsExclusive) && (dropOffIsExclusive))
    {
      throw(logger.logErrorReport("ERROR_DIST","/1.0/CountryControllers/SGPControllers/qrDocklessDropCheck@251",
        [userId,userTripId,qrString,userLat,userLng,dropOffStationId]));
    }
    else
    {
        return dbController.removeTripQueue(_userTripObj.scooterId,_accountGroup).then(function(){
          hardware.gpsLowRelayCommand(_accountGroup,_userTripObj.scooterId);
          return true;
        }).catch(function(err){
          logger.log("info",logger.logErrorReport("NO_TRIP_QUEUE","/1.0/qrDocklessDropCheck@359",[err]));
          return true;
        });
    }
  }).then(function(){
    return dbController.setGPSOBJ(_gpsObj.IMEI,{"stationId":dropOffStationId,
        "lastStatusChange":returnTime,"totalUsageTime":_gpsObj.totalUsageTime,
        "lat":parseFloat(userLat),"lng":parseFloat(userLng),"lastUsed":returnTime,"status":"Available"})
    .then(function(){
      
      if(_userTransactionObj.passId !== "NIL")
      {//means have pass covering this trip...
        var _userPassEndTime = _userTransactionObj.paymentTime + _userPassObj.passDuration
        var _hasPassExpired = _userPassEndTime >= returnTime ? false:true;
        var _passExpiryElapsedTime = _hasPassExpired ? returnTime - _userPassEndTime : 0;
        return algorithm.getFareZone(_passExpiryElapsedTime,pickUpZoneFare,pickUpZoneTimeBlock);
      }
      else
      {
        return algorithm.getFareZone(totalTime,pickUpZoneFare,pickUpZoneTimeBlock);
      }
    }).catch(function(err){
      throw(logger.logErrorReport("ERROR","/1.0/qrDocklessDropCheck@380",
        [userId,userTripId,qrString,userLat,userLng,err]));
    });
  }).then(function(fareData){ //Pricing-matters fall in here
    etcFare = dropOffZoneUnlockFare;
    if(totalTime < 60000){
      totalFare = 0;
    }
    else {
      totalFare = fareData.fareInCents + etcFare;

    }
    var rebateAmount = 0;
    // Rebate matters
    if (totalFare > 500){
        rebateAmount = 0.1 * totalFare;
    }
    

    var _commonCountry = _userObj.country === "NIL" ? "DEF" : _userObj.country;
    return commonRef.child(_commonCountry).once("value").then(function(_commonSnapshot){
      if(_commonSnapshot.exists())
      {
        return _commonSnapshot.val();
      }
      else
      {
        return new commonModel();
      }
    }).catch(function(err){
      logger.log("info",logger.logErrorReport("NO_COMMON_FOUND","/1.0/qrDocklessDropCheck@397",[err]));
      return new commonModel();
    });
  }).then(function(_commonObjRecv){
    Object.assign(_commonObj,_commonObjRecv);
    if(_commonObj.stripeSecretKey === "NIL" || _commonObj.stripePublishKey === "NIL" ||
    _userObj.currency === "NIL" || _userObj.country === "NIL" || totalFare <= 0 ||
    _userObj.creditCardToken === "NIL")
    {// means stripe not available or no FARE or no credit card Token - just deduct from user's credit
      if(isQRStation)
      {
        dbController.setStationOBJ(dropOffStationId,{"scooterAvail":++_userDropOffStation.scooterAvail},
        _accountGroup);
      }
      
      Object.assign(_userObj,{
        "credits": _userObj.credits - totalFare + rebateAmount
      });
      dbController.setUserOBJ(userId,_userObj,_accountGroup).then(function(){
        Object.assign(_userTripObj,{
          "country": _userObj.country,
          "currency": _userObj.currency,
          "userLocationAtDropOff":_userLocationAtDropOff,
          "status":"DROPOFF_COMPLETION", //DROPOFF_RETURNED FOR PHOTO-TAKING
          "etcFare":etcFare,
          "totalDuration":totalTime,
          "totalFare":totalFare,
          "isDropOffInOperatingZone":isUserInOperatingZone,
          "isDropOffInStation":isUserWithinStation,
          "dropOffStationId" : dropOffStationId,
          "dropOffStationName" : dropOffStationName,
          "dropOffZoneId" : dropOffZoneId,
          "dropOffTime": returnTime,
          "rebateAmount": rebateAmount
        });

        Object.assign(newTripObj,tripSnapShot.val(),{"tripId":userTripId}, {"userId": userId}, {"count": count})
        userTransactionToReturn.push(newTripObj);
        newTripObj.feedback = mysql.escape(newTripObj.feedback);

        var insert_query = "INSERT INTO trips (ID, IMEI, passTransactionId, status,  isMultiTrip, paymentType, userLocationAtBookingLat, userLocationAtBookingLong, userLocationAtDropOffLat, ";
        var insert_query2 = insert_query.concat("userLocationAtDropOffLong, pickUpStationId, pickUpStationName, pickUpZoneId, pickUpTime, pickUpZoneFare, pickUpZoneTimeBlock, totalFare, totalDuration, country, ");
        var insert_query3 = insert_query2.concat("currency, etcFare, dropOffStationId, dropOffStationName, dropOffZoneId, dropOffTime, dropOffZoneFare, dropOffZoneTimeBlock, userId, rating, feedback, scooterId)");

        
        var query = insert_query3.concat("VALUES ('"+ newTripObj.tripId + "','"+ newTripObj.IMEI +  "','" + newTripObj.passTransactionId +  "','" + newTripObj.status +  "',");  
          var query2 = query.concat( newTripObj.isMultiTrip + ",'"+ newTripObj.paymentType + "'," + newTripObj.userLocationAtBooking[0] + "," +newTripObj.userLocationAtBooking[1] +"," );
          var query3 = query2.concat(newTripObj.userLocationAtDropOff[0] + "," + newTripObj.userLocationAtDropOff[1] + ",'" + newTripObj.pickUpStationId + "','" + newTripObj.pickUpStationName + "','" + newTripObj.pickUpZoneId + "',");
          var query4 = query3.concat(newTripObj.pickUpTime + "," + newTripObj.pickUpZoneFare + "," + newTripObj.pickUpZoneTimeBlock + "," + newTripObj.totalFare + "," + newTripObj.totalDuration + ",'");
          var query5 = query4.concat(newTripObj.country + "','" + newTripObj.currency + "'," + newTripObj.etcFare + ",'" + newTripObj.dropOffStationId + "','" + newTripObj.dropOffStationName + "','");
          var query6 = query5.concat(newTripObj.dropOffZoneId + "'," + newTripObj.dropOffTime + "," + newTripObj.dropOffZoneFare + "," + newTripObj.dropOffZoneTimeBlock + ",'" + newTripObj.userId + "',");
          var query7 = query6.concat(newTripObj.rating + "," + newTripObj.feedback + ",'"+ newTripObj.scooterId +"')" );

        //  logger.logAPICall([],"/app.js/SqlUpdateCron@244",[query7],[]);
        conn.query( query7 , function(err,result){
            if (err) {
             // logger.catchFunc2([],"ERROR","/app.js/SqlUpdateCron@286_QUERY :" + query7,[err],[],400,"https://ibb.co/k2zQzG");   
          console.log("ERROR, QUERY: " + query7)
            }
              else{
              //  logger.logAPICall([],"/v1.2/updateAllTrips@2455_COUNT:" + count,[],[]);
                console.log("SUCCESS,  QUERY: " + query7)
              } 
              })

        return dbController.setTripOBJ(userId,userTripId,_userTripObj,_accountGroup);

        // Update/ Insert SQL Row into MySQL Database
          

      }).then(function(){
        deferred.resolve({"status":"OK","tripStatus":"DROPOFF_COMPLETION"});
      });
    }
    else
    {
      stripe = require("stripe")(_commonObj.stripeSecretKey);
      var _totalFareLeft = _userObj.credits - totalFare;
      if(_totalFareLeft < 0) // call stripe......
      {
        stripe.paymentIntents.create({
          description: "Trip Payment for User " + userId,
          amount: (_totalFareLeft*-1),
          customer: _userObj.customerId,
          currency: _userObj.currency,
          payment_method: _userObj.creditCardToken,
          confirm: true,
          metadata:{
            "userId":userId,
            "tripId":userTripId
          }
        }).then(function(_paymentIntentObj){
          Object.assign(_userPaymentIntent,_paymentIntentObj);
          if(_userPaymentIntent.status === "succeeded")
          {
            //fetch the payment method object here
            return stripe.paymentMethods.retrieve(_userPaymentIntent.payment_method).catch(function(e){
              logger.log("info",logger.logErrorReport("ERROR","/1.0/qrDocklessDropCheck@470",[e]));
              return new paymentMethodModel();
            });
          }
          else
          {
            throw(logger.logErrorReport("ERROR_PAYMENT","/1.0/qrDocklessDropCheck@476",
              [_userId,_userPaymentIntent.status,accountGroup]));
          }
        }).then(function(_paymentMethod){
          Object.assign(_userPaymentMethod,_paymentMethod);
       
          Object.assign(_userObj,{
            "credits" : parseInt(0) + rebateAmount,
            "creditCardToken":_userPaymentIntent.payment_method,
            "creditCardType":_paymentMethod.card.brand === "NIL" ? _userObj.creditCardType : _paymentMethod.card.brand,
            "creditCardNumber":_paymentMethod.card.last4 === "NIL" ? _userObj.saveCreditCard : _paymentMethod.card.last4,
            "creditCardUID":_paymentMethod.card.fingerprint === "NIL" ? _userObj.creditCardUID : _paymentMethod.card.fingerprint
          });
          return dbController.setUserOBJ(userId,_userObj,_accountGroup);
        }).then(function(){
          Object.assign(_userTripObj,{
            "country": _userObj.country,
            "currency": _userObj.currency,
            "userLocationAtDropOff":_userLocationAtDropOff,
            "status":"DROPOFF_COMPLETION", //DROPOFF_RETURNED FOR PHOTO-TAKING
            "etcFare":etcFare,
            "totalDuration":totalTime,
            "totalFare":totalFare,
            "isDropOffInOperatingZone":isUserInOperatingZone,
            "isDropOffInStation":isUserWithinStation,
            "dropOffStationId" : dropOffStationId,
            "dropOffStationName" : dropOffStationName,
            "dropOffZoneId" : dropOffZoneId,
            "dropOffTime": returnTime,
          });
          return dbController.setTripOBJ(userId,userTripId,_userTripObj,_accountGroup);
        }).then(function(){
          var _transactionTemp = new transactionModel();
          Object.assign(_transactionTemp,{
            "creditCardToken":_userObj.creditCardToken,
            "creditCardType":_userObj.creditCardType,
            "creditCardNumber":_userObj.creditCardNumber,
            "paymentAmount":parseInt(_totalFareLeft*-1),
            "paymentType": 6,
            "country":_userObj.country,
            "currency":_userObj.currency
          })
          return transactionRef.child(userId).child(_userPaymentIntent.id).update(_transactionTemp);
        }).then(function(){
          deferred.resolve({"status":"OK","tripStatus":"DROPOFF_COMPLETION"});
        }).catch(function(err){
          logger.log("info",logger.logErrorReport("ERROR_STRIPE_CHARGE_FAILED","/1.0/qrDocklessDropCheck@464",[err]));
          if(isQRStation)
          {
            dbController.setStationOBJ(dropOffStationId,{"scooterAvail":++_userDropOffStation.scooterAvail},
            _accountGroup);
          }
          Object.assign(_userObj,{
            "credits": _userObj.credits - totalFare + rebateAmount
          });
          dbController.setUserOBJ(userId,_userObj,_accountGroup).then(function(){
            Object.assign(_userTripObj,{
              "country": _userObj.country,
              "currency": _userObj.currency,
              "userLocationAtDropOff":_userLocationAtDropOff,
              "status":"DROPOFF_COMPLETION", //DROPOFF_RETURNED FOR PHOTO-TAKING
              "etcFare":etcFare,
              "totalDuration":totalTime,
              "totalFare":totalFare,
              "isDropOffInOperatingZone":isUserInOperatingZone,
              "isDropOffInStation":isUserWithinStation,
              "dropOffStationId" : dropOffStationId,
              "dropOffStationName" : dropOffStationName,
              "dropOffZoneId" : dropOffZoneId,
              "dropOffTime": returnTime,
            });
            return dbController.setTripOBJ(userId,userTripId,_userTripObj,_accountGroup);
          }).then(function(){
            deferred.resolve({"status":"OK","tripStatus":"DROPOFF_COMPLETION"});
          });
        });
      }
      else // just end..
      {
        if(isQRStation)
        {
          dbController.setStationOBJ(dropOffStationId,{"scooterAvail":++_userDropOffStation.scooterAvail},
          _accountGroup);
        }
        Object.assign(_userObj,{
          "credits": _userObj.credits - totalFare
        });
        dbController.setUserOBJ(userId,_userObj,_accountGroup).then(function(){
          Object.assign(_userTripObj,{
            "country": _userObj.country,
            "currency": _userObj.currency,
            "userLocationAtDropOff":_userLocationAtDropOff,
            "status":"DROPOFF_COMPLETION", //DROPOFF_RETURNED FOR PHOTO-TAKING
            "etcFare":etcFare,
            "totalDuration":totalTime,
            "totalFare":totalFare,
            "isDropOffInOperatingZone":isUserInOperatingZone,
            "isDropOffInStation":isUserWithinStation,
            "dropOffStationId" : dropOffStationId,
            "dropOffStationName" : dropOffStationName,
            "dropOffZoneId" : dropOffZoneId,
            "dropOffTime": returnTime,
          });
          return dbController.setTripOBJ(userId,userTripId,_userTripObj,_accountGroup);
        }).then(function(){
          deferred.resolve({"status":"OK","tripStatus":"DROPOFF_COMPLETION"});
        });
      }
    }
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/qrDocklessDropCheck@419",[err]));
    deferred.reject(err);
  });
  return deferred.promise;
}

exports.tripCompleted = function(userId,tripId,rating,feedback,_accountGroup)
{
  const deferred= Q.defer();
  var _userTripObj = new tripModel();

  try {
    dbController.getTripObj(userId,tripId,_accountGroup).then(function(tripObb){
      Object.assign(_userTripObj,tripObb);
      return dbController.getScooterOBJ(_accountGroup,_userTripObj.scooterId);
    }).then(function(_scooterObjRecv){
      return dbController.setGPSOBJ(_scooterObjRecv.IMEI,{"rating":parseInt(rating)});
    }).then(function(){
      Object.assign(_userTripObj,{
        "status":"COMPLETED",
        "rating":parseInt(rating),
        "feedback":feedback
      });
      return dbController.setTripOBJ(userId,tripId,_userTripObj,_accountGroup);
    }).then(function(data){
      deferred.resolve(data);
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/tripCompleted@450",[err]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/tripCompleted@454",[e]));
    deferred.reject();
  }

  return deferred.promise;
}

exports.getBestScooters = function(qrScooterId,userLat,userLng,userId,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const gpsRef = db.ref("GPS");
  const userRef = _accountGroup === undefined || _accountGroup === "NIL" ? db.ref("Users") :
    db.ref(_accountGroup).child("Users");
  var scooterBatteryLevel = 0;
  var _scooterObj = new gpsModel();
  var _userContact = "NIL";
  try {
    userRef.child(userId).once("value").then(function(userSnapShot){
      var _fetchUserCountryCode = userSnapShot.child("countryCode").exists() ? userSnapShot.val()["countryCode"] : "NIL";
      var _fetchUserContact = userSnapShot.child("contact").exists() ? userSnapShot.val()["contact"] : "NIL";
        _userContact = (_fetchUserCountryCode + "") + (_fetchUserContact + "");
      return gpsRef.orderByChild("accountGroup").equalTo(_accountGroup).once("value");
    }).then(function(gpsObj){
        if (!gpsObj.exists() || qrScooterId === "NIL")
        {
          throw(logger.logErrorReport("ERROR","/1.0/getBestScooters@474",[qrScooterId,userLat,userLng,userId]));
        }
        else {
          gpsObj.forEach(function(snapshot){
            var _tempScooterObj = new gpsModel();
            Object.assign(_tempScooterObj,snapshot.val());
            if(qrScooterId === _tempScooterObj.scooterId)
            {
              scooterBatteryLevel = parseFloat(algorithm.map_range(_tempScooterObj.Battery,31,42,0,100));
              Object.assign(_scooterObj,snapshot.val(),{
                "IMEI": snapshot.ref.key,
                "batteryStatus": scooterBatteryLevel >= 65 ? "LONG_TRIP" : "SHORT_TRIP" ,
                "status": scooterBatteryLevel <= 35 ? "BatteryLow" : _tempScooterObj.status,
                "Battery": scooterBatteryLevel,
                "Distance": parseFloat(algorithm.map_range(_tempScooterObj.Battery,31,42,0,27))
              });
  
              if(_scooterObj.status === "LTD")
              {
                gpsRef.child(_scooterObj.IMEI).update({"lat":parseFloat(userLat),"lng":parseFloat(userLng)});
                webhookOPS.send({
                "text": "MiMi saw LTD SCOOTER being scanned!",
                "attachments": [{
                    "title": "Event Details - User Attempting to Scan LTD Scooter(Click Me for User's Location!)",
                    "title_link":"https://www.google.com/maps/?q="+userLat+","+userLng,
                    "fields": [
                      {
                        "title": "scooterId",
                        "value": qrScooterId,
                        "short": true
                      },
                      {
                        "title": "userId",
                        "value": userId,
                        "short": true
                      },
                      {
                        "title":"contact",
                        "value":_userContact,
                        "short": true
                      }
                    ],
                    "color": "#F35A00"
                }]
                });
              }
              else if(_scooterObj.status === "Ops_PickUp")
              {
                gpsRef.child(_scooterObj.IMEI).update({"lat":parseFloat(userLat),"lng":parseFloat(userLng)});
                webhookOPS.send({
                "text": "MiMi saw OPS_PICKUP SCOOTER being scanned!",
                "attachments": [{
                    "title": "Event Details - User Attempting to Scan OPS_PICKUP Scooter(Click Me for User's Location!)",
                    "title_link":"https://www.google.com/maps/?q="+userLat+","+userLng,
                    "fields": [
                      {
                        "title": "scooterId",
                        "value": qrScooterId,
                        "short": true
                      },
                      {
                        "title": "userId",
                        "value": userId,
                        "short": true
                      },
                      {
                        "title":"contact",
                        "value":_userContact,
                        "short": true
                      }
                    ],
                    "color": "#F35A00"
                }]
                });
              }
              else if(_scooterObj.status === "BatteryLow")
              {
                gpsRef.child(_scooterObj.IMEI).update({"lat":parseFloat(userLat),"lng":parseFloat(userLng)});
              }
            }
          });
          deferred.resolve(_scooterObj)
        }
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/getBestScooters@564",[qrScooterId,userLat,userLng,err]));
      deferred.reject();
    });
  } catch(e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getBestScooters@568",[qrScooterId,userLat,userLng,e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.scooterReturned = function(userId,_accountGroup)
{
  var deferred = Q.defer();
  var datatoret = {};

  const db = dbUtil.admin.database();
  const dbTripRef = _accountGroup === undefined || _accountGroup === "NIL" ?
    db.ref("Trips") : db.ref(_accountGroup).child("Trips");

  	dbTripRef.child(userId).orderByChild("bookingTime").limitToLast(1).once("value").then(function(snapshot)
  	{
  		if (!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR","/1.7/getLastTripOBJ@213",[userId]));
  		}
      else {
        snapshot.forEach(function(childSnapShot2)
        {
          var tripObjToReturn = new tripModel();
          Object.assign(tripObjToReturn,childSnapShot2.val(),{"tripId":childSnapShot2.key});
          return tripObjToReturn;
        });
      }
    }).then(function(tripOBJ){
      datatoret["totalDuration"] = tripOBJ.totalDuration;
      datatoret["totalFare"] = tripOBJ.totalFare;
      return dbController.getUserOBJ(userId,_accountGroup);
  }).then(function(userOBJ){
    datatoret["creditBalance"] = userOBJ.userFoundAt == "MYS" ? userOBJ.MYSCredits : userOBJ.SGPCredits;
    deferred.resolve(datatoret);
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/scooterReturned@606",[userId]));
    deferred.reject();
  });

  return deferred.promise;
};
