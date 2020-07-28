const Q = require('q');
const uuidv4 = require('uuid/v4');
const geolib = require('geolib');
const GeoFire = require('geofire');
const countryIso = require('country-iso');

const dbUtil = app_require('util/DBUtil.js');
const logger = app_require('util/loggerUtil.js');
const algorithm = app_require('util/Algorithm.js');

const gpsModel = app_require('versions/1.0/Model/GPS.js');
const zoneModel = app_require('versions/1.0/Model/Zone.js');
const userModel = app_require('versions/1.0/Model/User.js');
const tripModel = app_require('versions/1.0/Model/Trip.js');
const transactionModel = app_require('versions/1.0/Model/Transaction.js');
const promoModel = app_require('versions/1.0/Model/Promo.js');
const passModel = app_require('versions/1.0/Model/Pass.js');
const stationModel = app_require('versions/1.0/Model/Station.js');
const tripQueueModel = app_require('versions/1.0/Model/TripQueue.js');
const commonModel = app_require('versions/1.0/Model/Common.js');

const dd = app_require('versions/1.0/DBController.js');

exports.getScooterOBJ = function(_accountGroup,scooterId)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const _foundGPSObj = new gpsModel();
  try{
    var gpsRef = db.ref("GPS").orderByChild("accountGroup").equalTo(_accountGroup).limitToLast(1);
    gpsRef.once("value").then(function(snapshot){
      if (!snapshot.exists() || scooterId === "NIL")
      {
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getScooterOBJ@34",[_accountGroup,scooterId]));
      }
      else {
        snapshot.forEach(function(scooterobj){
          var _gpsObj = new gpsModel();
          Object.assign(_gpsObj,scooterobj.val(),{"IMEI":scooterobj.ref.key});
          if(_gpsObj.scooterId === scooterId)
          {
            Object.assign(_foundGPSObj,_gpsObj);
          }
        });
        if(_foundGPSObj.IMEI === "NIL")
        {
          throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getScooterOBJ@47",[_accountGroup,scooterId]));
        }
        else
        {
          deferred.resolve(_foundGPSObj);
        }
      }
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getScooterOBJ@55",[err]));
      deferred.reject();
    });
  }catch(e)
  {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getScooterOBJ@44",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.checkIfLatLngInOperatingZones = function(userLat,userLng,_accountGroup)
{
  var deferred = Q.defer();
  var _zoneObj = new zoneModel();

  dd.getNearbyZones(userLat,userLng,6,_accountGroup).then(function(zoneArr){
    if(zoneArr.length !== 0)
    {
     zoneArr.forEach(function(zoneObj){
       var _zoneBoundaries = zoneObj.zoneBoundaries;
       var _isInside = geolib.isPointInside({"latitude": userLat,"longitude": userLng},_zoneBoundaries);
       if(_isInside)
       {
         Object.assign(_zoneObj,zoneObj,{
          "lat":zoneObj.l[0],
          "lng":zoneObj.l[1]
         });
       }
     });

     if(_zoneObj.zoneId === undefined)
     {
       deferred.resolve({});
     }
     else {
       deferred.resolve(_zoneObj);
     }
    }
    else {
      deferred.resolve({});
    }
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/checkIfLatLngInOperatingZones@82",[err]));
    deferred.reject();
  });

  return deferred.promise;
}

exports.getNearbyZones = function(lat,lng,radiusKM,_accountGroup){
    var deferred = Q.defer();
    var db = dbUtil.admin3.database();
    const zoneRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("ZoneGeoFire") : db.ref(_accountGroup).child("ZoneGeoFire");
    var geoFire = new GeoFire(zoneRef);
    var arr = [];
  
    var geoQuery = geoFire.query({
      center: [parseFloat(lat),parseFloat(lng)],
      radius: parseFloat(radiusKM)
    });
  
    geoQuery.on("key_entered", function(key, location, distance) {
      arr.push({"zoneId":key,"distance":distance*1000});
    });
  
    geoQuery.on("ready", function() {
      geoQuery.cancel();
      var arrayToReturn = [];
      var promiseToReturn = [];
      var arrayToProcess = [];
  
      arr.sort(function(a,b){return a.distance - b.distance});
      arr.forEach(function(item,index){
        arrayToProcess.push(item.zoneId);
      });
  
      zoneRef.once("value").then(function(arr2)
      {
        arr2.forEach(function(item,index){
          if(arrayToProcess.includes(item.zoneId))
          {
            var arrayIndexNum = arrayToProcess.indexOf(item.zoneId);
            Object.assign(item, {"distance":arr[arrayIndexNum].distance});
            arrayToReturn.push(item);
          }
          promiseToReturn.push(deferred.promise);
        });
      }).catch(function(err){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getNearbyZones@134",[err]));
        deferred.reject([]);
      });
      Q.all(promiseToReturn).then(function(){
        arrayToReturn.sort(function(a,b){return a.distance - b.distance});
        deferred.resolve(arrayToReturn);
      }).catch(function(err){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getNearbyZones@141",["NIL"]));
        deferred.reject([]);
      });
    });
    return deferred.promise;
}

exports.setUserOBJ = function(userId,userobj,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();

	try {
    var usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Users").child(userId) : db.ref(_accountGroup).child("Users").child(userId);
	  usersRef.once("value").then(function(snapshot){
	    if (!snapshot.exists())
	    {
	      throw(logger.logErrorReport("ERROR","/1.0/setUserOBJ@367",[userId,_accountGroup,userobj]));
	    }
	    else {
        var _userObj = new userModel();
        Object.assign(_userObj,snapshot.val(),userobj);
	      return usersRef.update(_userObj);
	    }
	  }).then(function(){
	    deferred.resolve({"status":"OK"});
	  }).catch(function(err){
	    logger.log("error",logger.logErrorReport("ERROR","/1.0/setUserOBJ@375",[err]));
	    deferred.reject();
	  });
	} catch (e) {
		logger.log("error",logger.logErrorReport("ERROR","/1.0/setUserOBJ@379",[e]));
		deferred.reject();
	}
  return deferred.promise;
};

exports.insertPromo = function(userId,promoId,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const _timenow = new Date().getTime();

  var _userObj = new userModel();
  var _promoObj = new promoModel();

  try {
    const usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Users").child(userId) : db.ref(_accountGroup).child("Users").child(userId);
    const usersOriginRef = _accountGroup === undefined || _accountGroup === "NIL" ?
      db.ref("Users") : db.ref(_accountGroup).child("Users");
    const transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Transactions").child(userId).child(promoId) : 
      db.ref(_accountGroup).child("Transactions").child(userId).child(promoId)
    const marketingRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Marketing").child("Promo").child("Active").child(promoId) :
      db.ref(_accountGroup).child("Marketing").child("Promo").child("Active").child(promoId);
    const passRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Marketing").child("Subscriptions") : 
      db.ref(_accountGroup).child("Subscriptions");

    usersRef.once("value").then(function(snapshot){
      if (!snapshot.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/insertPromo@448",[userId,promoId]));
      }
      else {
        Object.assign(_userObj,snapshot.val());
        return marketingRef.once("value");
      }
    }).then(function(snapshot3){
      if (!snapshot3.exists())
      {
        throw(logger.logErrorReport("ERROR","/1.0/insertPromo@462",[userId,promoId]));
      }
      else {
        Object.assign(_promoObj,snapshot3.val());
        return transactionRef.once("value");
      }
    }).then(function(snapshot2){
      if (snapshot2.exists())
      {
        throw(logger.logErrorReport("ERROR_USED","/1.0/insertPromo@482",[userId,promoId]));
      }
      else {
        if(_promoObj.claimed >= _promoObj.limit)
        {
          throw(logger.logErrorReport("ERROR_LIMIT","/1.0/insertPromo@487",[userId,promoId]));
        }
        else {
          _userObj.credits = _userObj.credits + _promoObj.credit;
          if(_promoObj.passId !== "NIL")
          {
            return passRef.child(_promoObj.passId).once("value").then(function(_snapshot){
              if(_snapshot.exists())
              {
                var _transactionObj = new transactionModel();
                Object.assign(_transactionObj,{
                  "passId":_promoObj.passId,
                  "creditCardType":"PROMO-PASS",
                  "creditCardNumber":"PROMO-PASS",
                  "hasExpired":false,
                  "paymentTime":parseInt(_timenow),
                  "paymentType":3,
                  "country" : _promoObj.country,
                  "currency" : _promoObj.currency,
                  "passLevel" : _snapshot.child("passLevel").exists() ? _snapshot.val()["passLevel"] : 0
                });
                return transactionRef.update(_transactionObj);
              }
              else {
                throw(logger.logErrorReport("INFO","/1.0/insertPromo@514",[userId,promoId,_promoObj.passId]));
              }
            }).then(function(){
              return dd.getUsersByContact(_userObj.contact,_accountGroup);
            }).then(function(_userArrObj){
              if(_userArrObj === null || _userArrObj.length === 0)
              {
                throw(logger.logErrorReport("INFO","/1.0/insertPromo@255",[userId,promoId,_userObj.contact,
                  _promoObj.passId]));
              }
              else
              {
                var _foundUserObj = _userArrObj.find(function(_userInArr){
                  return _userInArr.country === _promoObj.country;
                });
                if(_promoObj.country === "NIL") // add into user's target 
                {
                  return usersOriginRef.child(userId).update({
                    "credits": _userObj.credits
                  });
                }
                else if(_foundUserObj === undefined)
                {
                  //cannot find international wallet, create and assign new credit 
                  var _newUserObj = new userModel();
                  Object.assign(_newUserObj,{
                    "authenticated":true,
                    "CEPAS": "NIL",
                    "contact" : _userObj.contact + "",
                    "countryCode" : _userObj.countryCode,
                    "country" : _promoObj.country,
                    "currency" : _promoObj.currency,
                    "creditCardNumber" : "CREDIT CARD",
                    "creditCardType" : "CREDIT CARD",
                    "registrationDate" : new Date().getTime(),
                    "credits": _promoObj.credit
                  });
                  return usersOriginRef.child(uuidv4()).update(_newUserObj);
                }
                else
                {
                  _foundUserObj.credits = _foundUserObj.credits + _promoObj.credit;
                  return usersOriginRef.child(_foundUserObj.userId).update({
                    "credits": _foundUserObj.credits
                  });      
                }
              }
            }).catch(function(err){
              logger.log("error",logger.logErrorReport("ERROR","/1.0/insertPromo@294",[err]));
              throw(logger.logErrorReport("INFO","/1.0/insertPromo@295",[userId,promoId,_userObj.contact,
                _promoObj.passId]));
            });
          }
          else
          {

            var _transactionObj = new transactionModel();
            Object.assign(_transactionObj,{
              "passId":"NIL",
              "creditCardType":"PROMO-CODE",
              "creditCardNumber":"PROMO-CODE",
              "hasExpired":false,
              "paymentTime":parseInt(_timenow),
              "paymentType":1,
              "country" : _promoObj.country,
              "paymentAmount" : _promoObj.credit,
              "passLevel" : -1
            });

            return transactionRef.update(_transactionObj).then(function(){
              return dd.getUsersByContact(_userObj.contact,_accountGroup);
            }).then(function(_userArrObj){
              if(_userArrObj === null || _userArrObj.length === 0)
              {
                throw(logger.logErrorReport("INFO","/1.0/insertPromo@255",[userId,promoId,_userObj.contact,
                  _promoObj.passId]));
              }
              else
              {
                var _foundUserObj = _userArrObj.find(function(_userInArr){
                  return _userInArr.country === _promoObj.country;
                });
                if(_promoObj.country === "NIL") // add into user's target 
                {
                  return usersOriginRef.child(userId).update({
                    "credits": _userObj.credits
                  });
                }
                else if(_foundUserObj === undefined)
                {
                  //cannot find international wallet, create and assign new credit 
                  var _newUserObj = new userModel();
                  Object.assign(_newUserObj,{
                    "authenticated":true,
                    "CEPAS": "NIL",
                    "contact" : _userObj.contact + "",
                    "countryCode" : _userObj.countryCode,
                    "country" : _promoObj.country,
                    "currency" : _promoObj.currency,
                    "creditCardNumber" : "CREDIT CARD",
                    "creditCardType" : "CREDIT CARD",
                    "registrationDate" : new Date().getTime(),
                    "credits": _promoObj.credit
                  });
                  return usersOriginRef.child(uuidv4()).update(_newUserObj);
                }
                else
                {
                  _foundUserObj.credits = _foundUserObj.credits + _promoObj.credit;
                  return usersOriginRef.child(_foundUserObj.userId).update({
                    "credits": _foundUserObj.credits
                  });      
                }
              }
            }).catch(function(e){
              throw(logger.logErrorReport("INFO","/1.0/insertPromo@316",[userId,promoId,_userObj.contact,
                _promoObj.passId]));
            });
          }
        }
      }
    }).then(function(){
      return marketingRef.update({"claimed":++_promoObj.claimed});
    }).then(function(){
      deferred.resolve({"status":"OK","promoCredit":_promoObj.credit,"promoLimit":_promoObj.limit});
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/insertPromo@318",[err]));
      deferred.reject(err);
    });
} catch (e) {
  logger.log("error",logger.logErrorReport("ERROR","/1.0/insertPromo@322",[e]));
  deferred.reject(e);
}

	return deferred.promise;
}

exports.getUsersByContact = function(_contact,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  var _userObjArr = [];
  try {
    const usersRef = _accountGroup === undefined || _accountGroup === "NIL" ?
      db.ref("Users") : db.ref(_accountGroup).child("Users");

    usersRef.orderByChild("contact").equalTo(_contact).once("value").then(function(snapshot)
    {
      if(!snapshot.exists())
      {
        deferred.resolve(_userObjArr);
      }
      else {
        snapshot.forEach(function(_userObjFound){
          var _userObj = new userModel();
          Object.assign(_userObj,_userObjFound.val(),{"userId":_userObjFound.ref.key});
          _userObjArr.push(_userObj);
        });
        deferred.resolve(_userObjArr);
      }
    }).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.getSetUserOBJ@2207",[error]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getSetUserOBJ@2212",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.getAllPass = function(_userId,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const passRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Marketing").child("Subscriptions") : 
    db.ref(_accountGroup).child("Subscriptions");
  var usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Users").child(_userId) : db.ref(_accountGroup).child("Users").child(_userId);
  var arrayToReturn = [];
  var _userObj = new userModel();
  
  usersRef.once("value").then(function(_userObjRecv){
    if(_userObjRecv.exists())
    {
      Object.assign(_userObj,_userObjRecv.val(),{"userId":_userId});
    }
    else
    {
      Object.assign(_userObj,{"userId":"NIL"}); 
    }
    return passRef.once("value");
  }).then(function(snapshot){
    if(snapshot.exists())
    {
      snapshot.forEach(function(_passObjInArr){
        var _passObjToStore = new passModel();
        Object.assign(_passObjToStore,_passObjInArr.val(),{
          "passId":_passObjInArr.ref.key
        });
        if(_userId === "NIL")
        {
          arrayToReturn.push(_passObjToStore);
        }
        else if(_userObj.country === _passObjToStore.country)
        {
          arrayToReturn.push(_passObjToStore);
        }
      });
      deferred.resolve(arrayToReturn);
    }
    else
    {
      deferred.resolve(arrayToReturn)
    }
  }).catch(function(e){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getAllPass@458",[e]));
    deferred.reject();
  });

  return deferred.promise;
};

exports.getPassOBJ = function(passId,_accountGroup)
{
  var deferred = Q.defer();
  var db = dbUtil.admin.database();
  try {
    var subscriptionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Marketing").child("Subscriptions").child(passId) :
      db.ref(_accountGroup).child("Subscriptions").child(passId);
    subscriptionRef.once("value").then(function(snapshot)
    {
      if(!snapshot.exists())
      {
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/SGPControllers/getPassOBJ@477",[passId]));
      }
      else {
        var _passObjToReturn = new passModel();
        Object.assign(_passObjToReturn,snapshot.val(),{
          "passId":passId
        });
        deferred.resolve(_passObjToReturn);
      }
    }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/SGPControllers/getPassOBJ@487",[error]));
        deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/SGPControllers/getPassOBJ@491",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.getStationOBJ = function(stationId,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin3.database();
  try {
    var stationRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Stations").child(stationId) :
      db.ref(_accountGroup).child("Stations").child(stationId);
    
    stationRef.once("value").then(function(childSnapShot2){
    if (!childSnapShot2.exists())
    {
      throw (logger.logErrorReport("ERROR","/1.0/getStationOBJ@521",[stationId,_accountGroup]));
    }
    else {
      var _stationObj = new stationModel();
      Object.assign(_stationObj,childSnapShot2.val());
      deferred.resolve(_stationObj);
    }
  	}).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/getStationOBJ@530",[error]));
      deferred.reject();
  	});
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getStationOBJ@534",[e]));
    deferred.reject();
  }
	return deferred.promise;
}

exports.getUserActivePass = function(userId,_accountGroup)
{
	const deferred = Q.defer();
	const db = dbUtil.admin.database();

  try {
    const transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ?
      db.ref("Transactions").child(userId) : db.ref(_accountGroup).child("Transactions").child(userId)

    var userTransactionToReturn = [];
    var passObjs = [];
    var passDuration = 0;
    var passExpired;

    dd.getAllPass(userId,_accountGroup).then(function(_passObjInArr){
      passObjs = _passObjInArr;
      return transactionRef.orderByChild("paymentType").equalTo(3).once("value");
    }).then(function(snapshot)
  	{
  		if(!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getUserActivePass@562",[userId]));
  		}
      else {
        snapshot.forEach(function(innerSnapShot){
          var transactionId = innerSnapShot.ref.key;
          passExpired = innerSnapShot.child("hasExpired").exists() ? innerSnapShot.val()["hasExpired"] : false;
          if(!passExpired) // iterate thru user's transaction to expire any on-going pass
          {
            var _transactionObj = new transactionModel();
            Object.assign(_transactionObj,innerSnapShot.val(),{
              "transactionId":transactionId,
            });

            var _foundPass = passObjs.find(function(_passObj){
              return _passObj.passId === _transactionObj.passId;
            });
            passDuration = _foundPass === undefined ? 0 : _foundPass.passDuration;
            if((_transactionObj.paymentTime + passDuration) >= new Date().getTime())
            {
              userTransactionToReturn.push(_transactionObj);
            }
            else {
              transactionRef.child(transactionId).update({"hasExpired":true});
            }
          }
        });

        if(userTransactionToReturn.length === 0)
        {
          throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getUserActivePass@589",[userId]));
        }
        else {
          userTransactionToReturn.sort(function(a,b){return b.passLevel - a.passLevel});
          deferred.resolve(userTransactionToReturn);
        }
      }
    }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserActivePass@597",[error]));
        deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserActivePass@601",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.addTripQueue = function(userId,tripId,scooterId,pickUpStationId,fromStationName,
  toStationName,prevTripStatus,bookingtime,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const queueRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Queue") : db.ref(_accountGroup).child("Queue");

  queueRef.orderByChild("userId").equalTo(userId).limitToLast(1).once("value").then(function(microsnapshot){
    if(microsnapshot.exists() && prevTripStatus !== "MULTI_TRIP_STARTED" && prevTripStatus !== "TRIP_STARTED")
    {
      throw(logger.logErrorReport("ERROR","/1.0/addTripQueue@618",[userId,tripId,scooterId,pickUpStationId,
        fromStationName,toStationName,prevTripStatus,bookingtime]));
    }
    else
    {
      return queueRef.child(scooterId).once("value");
    }
  }).then(function(snapshot){
    if(snapshot.exists())
    {
      throw(logger.logErrorReport("ERROR","/1.0/addTripQueue@628",[userId,tripId,scooterId,pickUpStationId,
        fromStationName,toStationName,prevTripStatus,bookingtime]));
    }
    else
    {
      var _tripQueueObj = new tripQueueModel();
      Object.assign(_tripQueueObj,{
        "userId":userId,
        "tripId":tripId,
        "pickUpStationId": pickUpStationId,
        "from": fromStationName,
        "to": toStationName,
        "status": prevTripStatus,
        "bookingTime": parseInt(bookingtime)
      });

      return queueRef.child(scooterId).update(_tripQueueObj);
    }
  }).then(function(){
    deferred.resolve({"status":"OK"});
  }).catch(function(error){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/addTripQueue@1908",[error]));
    deferred.reject();
  });
  return deferred.promise;
}

exports.setStationOBJ = function(_stationId,_stationObj,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin3.database();
  try {
    var stationRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Stations").child(_stationId) :
      db.ref(_accountGroup).child("Stations").child(_stationId);
    stationRef.once("value").then(function(snapshot)
  	{
  		if (!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/setStationOBJ@668",[_stationId,_stationObj,_accountGroup]));
  		}
      else {
        var _stationObjFound = new stationModel();
        Object.assign(_stationObjFound,snapshot.val(),_stationObj);
        return stationRef.update(_stationObjFound);
      }
    }).then(function(){
      deferred.resolve({"status":"OK"});
    }).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/setStationOBJ@678",[error]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/setStationOBJ@682",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.setTripOBJ = function(_userId,_tripId,_tripObj,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();

  try {
    var tripRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Trips").child(_userId).child(_tripId) :
      db.ref(_accountGroup).child("Trips").child(_userId).child(_tripId)
    tripRef.update(_tripObj).then(function(){
      deferred.resolve({"status":"OK"});
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/setTripOBJ@699",[err]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/setTripOBJ@703",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.setGPSOBJ = function(_IMEI,_GPSObj)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  try {
    db.ref("GPS").child(_IMEI).once("value").then(function(snapshot)
  	{
  		if (!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/setGPSOBJ@718",[_IMEI,_GPSObj]));
  		}
      else {
        var _gpsObjFound = new gpsModel();
        Object.assign(_gpsObjFound,snapshot.val(),_GPSObj);
        return db.ref("GPS").child(_IMEI).update(_gpsObjFound);
      }
    }).then(function(){
      deferred.resolve({"status":"OK"});
    }).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/setGPSOBJ@728",[error]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/setGPSOBJ@732",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.getTripObj = function(userId,tripId,_accountGroup)
{
	const deferred = Q.defer();
	const db = dbUtil.admin.database();

  try {
    const tripsRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Trips").child(userId).child(tripId) :
      db.ref(_accountGroup).child("Trips").child(userId).child(tripId);
  	tripsRef.once("value").then(function(snapshot)
  	{
  		if(!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR","/1.0/getTripObj@751",[userId,tripId,_accountGroup]));
  		}
      else {
        var _tripObj = new tripModel();
        Object.assign(_tripObj,snapshot.val(),{
          "tripId": tripId,
          "userId": userId
        });
        deferred.resolve(_tripObj);
      }
    }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getTripObj@759",[error]));
        deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getTripObj@763",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.getUserOBJ = function(userId,_accountGroup)
{
	const deferred = Q.defer();
	const db = dbUtil.admin.database();

  try {
    const usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Users").child(userId) :
      db.ref(_accountGroup).child("Users").child(userId)
  	usersRef.once("value").then(function(snapshot)
  	{
  		if(!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR","/1.0/getUserOBJ@782",[userId,_accountGroup]));
  		}
      else {
        var userObj = new userModel();
        Object.assign(userObj,snapshot.val(),{"userId":userId});
        deferred.resolve(userObj);
      }
    }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserOBJ@790",[error]));
        deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserOBJ@794",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.getUserTransactionObj = function(userId,transactionId,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const transactionObj = new transactionModel();

  try {
    var transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Transactions").child(userId).child(transactionId) : 
      db.ref(_accountGroup).child("Transactions").child(userId).child(transactionId)
  	transactionRef.once("value").then(function(snapshot)
  	{
  		if(!snapshot.exists())
  		{
        throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getUserTransactionObj@814",[userId,transactionId,_accountGroup]));
  		}
      else {
          Object.assign(transactionObj,snapshot.val(),{"transactionId":transactionId});
          deferred.resolve(transactionObj);
      }
    }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserTransactionObj@821",[error]));
        deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserTransactionObj@825",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.removeTripQueue = function(scooterId,_accountGroup)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  try {
    const queueRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Queue").child(scooterId) : db.ref(_accountGroup).child("Queue").child(scooterId);
    queueRef.once("value").then(function(snapshot){
      if(snapshot.exists())
      {
        return queueRef.remove();
      }
      else
      {
        throw(logger.logErrorReport("ERROR","/1.0/removeTripQueue@846",[scooterId]));
      }
    }).then(function(){
      deferred.resolve({"status":"OK"});
    }).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/removeTripQueue@851",[error]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/removeTripQueue@855",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.getCommon = function(_lat,_lng,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  var _countryFound = _lat === -1 || _lng === -1 || countryIso.get(_lat, _lng).length === 0 ?
    "DEF" : countryIso.get(_lat, _lng)[0];

  const commonRef = _accountGroup === undefined || _accountGroup === "NIL" ?  
    db.ref("Common") : db.ref(_accountGroup).child("Common");

  commonRef.child(_countryFound).once("value").then(function(snapshot){
    if(snapshot.exists())
    {
      var _commonObj = new commonModel();
      Object.assign(_commonObj,snapshot.val(),{"commonId":_countryFound});
      deferred.resolve(_commonObj);
    }
    else {
      return commonRef.child("DEF").once("value").catch(function(){
        return function exists(){return false}
      });
    }
  }).then(function(_defSnapShot){
    if(_defSnapShot.exists())
    {
      var _commonObj = new commonModel();
      Object.assign(_commonObj,_defSnapShot.val(),{"commonId":_defSnapShot.ref.key});
      deferred.resolve(_commonObj);
    }
    else
    {
      var _commonObj = new commonModel();
      Object.assign(_commonObj,{"commonId":"DEF"});
      deferred.resolve(_commonObj);
    }
  }).catch(function(err){
    logger.log("error",err);
    deferred.reject();
  });

	return deferred.promise;
}

exports.getUserTrips = function(userId,type,limit,_accountGroup)
{
  var deferred = Q.defer();
  var db = dbUtil.admin.database();
  try {
    var tripRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Trips").child(userId) : db.ref(_accountGroup).child("Trips").child(userId);
    var operatorsToRet = [];

    tripRef.orderByChild("status").equalTo(type).limitToLast(limit).once("value").then(function(snapshot){
      var exists = snapshot.exists();
      if (!exists)
      {
        throw(logger.logErrorReport("ERROR","/1.0/getUserTrips@915",[userId,type]));
      }else {
        snapshot.forEach(function(childSnapShot2){
          var tripObj = new tripModel();
          Object.assign(tripObj,childSnapShot2.val(),{"tripId":childSnapShot2.ref.key});
          operatorsToRet.push(tripObj);
        });
        deferred.resolve(operatorsToRet);
      }
    }).catch(function(error){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserTrips@928",[error]));
      deferred.reject();
    });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserTrips@932",[e]));
    deferred.reject();
  }

  return deferred.promise;
}

exports.sendRefund = function(userId,_accountGroup)
{
  var deferred = Q.defer();
  dd.getUserOBJ(userId,_accountGroup).then(function(data){
    var userStatusCode = data.statusCode & 0x06;
    if(data.deposit >= 0 && (userStatusCode == 0 || userStatusCode == 4))
    {
      userStatusCode = (data.statusCode & 0xF9) | 0x02;
      return dd.setUserOBJ(userId,{"statusCode":userStatusCode},_accountGroup);
    }
    else {
      throw(logger.logErrorReport("ERROR","/1.0/sendRefund@396",[userId]));
    }
  }).then(function(){
    deferred.resolve({"status":"OK"});
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/sendRefund@401",[err]));
    deferred.reject();
  });
  return deferred.promise;
}

exports.updateTripImageUrl = function(userId,userTripId,imageURL,_accountGroup)
{
	const deferred = Q.defer();
	const db = dbUtil.admin.database();
  const db2 = dbUtil.admin2.database();

  try {
    var tripRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Trips").child(userId).child(userTripId) :
      db.ref(_accountGroup).child("Trips").child(userId).child(userTripId);
    var scooterImgLogsRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db2.ref("ScooterImgLogs") : db2.ref(_accountGroup).child("ScooterImgLogs");
    var scooterId;
    var tripStatus;
    var totalDuration = 0;
    var totalFare = 0;
    var _userFoundAt = "SGP";
    var _userLocationAtDropOff = [];

  	tripRef.once("value").then(function(snapshot)
  	{
  		var exists = snapshot.exists();
  		if (!exists)
  		{
        throw(logger.logErrorReport("ERROR","/1.0/updateTripImageUrl@1268",[userId,userTripId,imageURL]));
  		}
      else {
        scooterId = snapshot.child("scooterId").exists() ? snapshot.val()["scooterId"] : "NIL";
        tripStatus = snapshot.child("status").exists() ? snapshot.val()["status"] : "CANCELLED";
        totalDuration = snapshot.child("totalDuration").exists() ? snapshot.val()["totalDuration"] : 0;
        totalFare = snapshot.child("totalFare").exists() ? snapshot.val()["totalFare"] : 0;
        _userFoundAt = snapshot.child("userFoundAt").exists() ? snapshot.val()["userFoundAt"] : "SGP";
        _userLocationAtDropOff[0] = snapshot.child("userLocationAtDropOff").exists() ?
          parseFloat(snapshot.val()["userLocationAtDropOff"]["latitude"]) : -1;
        _userLocationAtDropOff[1] = snapshot.child("userLocationAtDropOff").exists() ?
          parseFloat(snapshot.val()["userLocationAtDropOff"]["longitude"]) : -1;

        return tripRef.update({"status":"DROPOFF_COMPLETION","scooterImgURL":imageURL});
      }
  	}).then(function(){
  		return dd.getScooterOBJ(_accountGroup,scooterId);
  	}).then(function(scooterOBJ){
  		if(scooterOBJ.lastUser == userId)
  		{
        var lastTimeStamp = new Date().getTime()
        scooterImgLogsRef.child(scooterId).child(lastTimeStamp).update({"lastImg":imageURL,
          "lastUser":userId,"l":_userLocationAtDropOff});
  			return dd.setScooterOBJ(scooterId,{"lastImg":imageURL,"lastSubmitted":lastTimeStamp});
  		}
  		else {
  			return true;
  		}
    }).then(function(){
      return dd.getUserOBJ(userId,_accountGroup);
    }).then(function(userob){
      var toReturn = {};
      toReturn["totalDuration"] = totalDuration;
      toReturn["totalFare"] = totalFare;
      toReturn["creditBalance"] = userob.credits
      deferred.resolve(toReturn);
    }).catch(function(error)
  	{
      logger.log("error",logger.logErrorReport("ERROR","/1.0/updateTripImageUrl@1311",[error]));
      deferred.reject();
  	});
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/updateTripImageUrl@1315",[e]));
    deferred.reject();
  }

	return deferred.promise;
};

exports.getUserOBJForFrontEnd = function(_contact,_userFoundAt,_userId,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  var _userObjArr = [];
  var _userCountryCode = "NIL";
  var _userCurrency = "NIL";
  try {
    const usersRef = _accountGroup === undefined || _accountGroup === "NIL" ?
      db.ref("Users") : db.ref(_accountGroup).child("Users");

    if(_userId !== "NIL")
    {
      usersRef.child(_userId).once("value").then(function(snapshot)
      {
        if(!snapshot.exists())
        {
          throw(logger.logErrorReport("ERROR","/1.0/getUserOBJForFrontEnd@1050",[_contact,_userFoundAt,_userId,_accountGroup]));
        }
        else
        {
          var _userObjToReturn = new userModel();
          Object.assign(_userObjToReturn,snapshot.val(),{"userId":snapshot.ref.key});
          _userObjArr.push(_userObjToReturn);
          deferred.resolve(_userObjArr);
        }
      }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.getUserOBJForFrontEnd@1060",[error]));
        deferred.reject();
      });
    }
    else if (_userFoundAt === "NIL")
    {
      usersRef.orderByChild("contact").equalTo(_contact).once("value").then(function(snapshot)
      {
        if(!snapshot.exists())
        {
          throw(logger.logErrorReport("ERROR","/1.0/getUserOBJForFrontEnd@1070",[_contact,_userFoundAt,_userId,_accountGroup]));
        }
        else {
          snapshot.forEach(function(_userObjFound){
            var _userCountryCode = _userObjFound.child("countryCode").exists() ?
              _userObjFound.val()["countryCode"] : "NIL";

            var _userCountry = _userObjFound.child("country").exists() ?
            _userObjFound.val()["country"] : "NIL";

            var _userFoundAt2 = algorithm.getCountryObjects().find(function(e){
              return e.dialCode === _userCountryCode;
            });
            var _userFoundAt3 = _userFoundAt2 === undefined || _userFoundAt2.country === undefined ?
              "NIL" : _userFoundAt2.country;
            if(_userFoundAt3 === _userCountry)
            {
              var _userObjToReturn = new userModel();
              Object.assign(_userObjToReturn,_userObjFound.val(),{"userId":_userObjFound.ref.key});
              _userObjArr.push(_userObjToReturn);
            }
          });
          deferred.resolve(_userObjArr);
        }
      }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.getUserOBJForFrontEnd@1095",[error]));
        deferred.reject();
      });
    }
    else
    {
      usersRef.orderByChild("contact").equalTo(_contact).once("value").then(function(snapshot)
      {
        if(!snapshot.exists())
        {
          throw(logger.logErrorReport("ERROR","/1.0/getUserOBJForFrontEnd@1105",[_contact,_userFoundAt,_userId,_accountGroup]));
        }
        else {
          snapshot.forEach(function(_userObjFound){
            var _userCountryWallet = _userObjFound.child("country").exists() ?
              _userObjFound.val()["country"] : "NIL";
            _userCountryCode = _userObjFound.child("countryCode").exists() ?
              _userObjFound.val()["countryCode"] : "NIL";
            if(_userCountryWallet === _userFoundAt)
            {
              var _userObjToReturn = new userModel();
              Object.assign(_userObjToReturn,_userObjFound.val(),{"userId":_userObjFound.ref.key});
              _userObjArr.push(_userObjToReturn);
            }
          });

          if(_userObjArr.length === 0)//means new country...
          {
            //create and return array..
            var _userFoundCountryObj = algorithm.getCountryObjects().find(function(e){
              return e.country === _userFoundAt;
            });
            _userCurrency = _userFoundCountryObj === undefined ? "NIL" : _userFoundCountryObj.currency;
            return dd.createUser(_contact,_userCountryCode,_userCurrency,_userFoundAt,_accountGroup).then(function(_dataRev){
              var _arrToStore = [];
              _arrToStore.push(_dataRev);
              deferred.resolve(_arrToStore);
            }).catch(function(error){
              throw(logger.logErrorReport("ERROR","/1.0/getUserOBJForFrontEnd@1133",[_contact,_userFoundAt,_userId,_accountGroup]));
            });
          }
          else
          {
            deferred.resolve(_userObjArr);
          }
        }
      }).catch(function(error){
        logger.log("error",logger.logErrorReport("ERROR","/1.getUserOBJForFrontEnd@1142",[error]));
        deferred.reject();
      });
    }
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUserOBJForFrontEnd@1147",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.createUser = function(_contact,_countryCode,_userCurrency,_userFoundAt,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  var _userObj = new userModel();
  try {
    var _userId = uuidv4();
    var usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
      db.ref("Users") : db.ref(_accountGroup).child("Users");

    Object.assign(_userObj,{
      "authenticated":true,
      "contact" : _contact + "",
      "countryCode" : _countryCode,
      "country" : _userFoundAt,
      "currency" : _userCurrency,
      "creditCardNumber" : "CREDIT CARD",
      "creditCardType" : "CREDIT CARD",
      "registrationDate" : new Date().getTime()
    });
    
    usersRef.child(_userId).update(_userObj).then(function(){
      _userObj["userId"] = _userId;
      deferred.resolve(_userObj);
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/createUser@1179",[err]));
      deferred.reject();
    });
  }
  catch (e) {
   logger.log("error",logger.logErrorReport("ERROR","/1.0/createUser@1184",[e]));
   deferred.reject();
  }
   return deferred.promise;
 }

 exports.getUsedUserContact = function(_userContact,_accountGroup)
{
	var deferred = Q.defer();
	var db = dbUtil.admin.database();
  var userObjToReturn2 = [];
  try {
    if(_userContact === -1 || _userContact === 0 || _userContact === "NIL")
    {
      deferred.resolve([]);
    }
    else {
      var usersRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
        db.ref("Users") : db.ref(_accountGroup).child("Users");
      usersRef.orderByChild("contact").equalTo(_userContact).once("value").then(function(snapshot)
      {
        if(!snapshot.exists())
        {
          deferred.resolve([]);
        }
        else {
          snapshot.forEach(function(childSnapShot2)
          {
            var _userObj = new userModel();
            Object.assign(_userObj,childSnapShot2.val(),{"userId":childSnapShot2.ref.key});
            userObjToReturn2.push(_userObj);
          });
          deferred.resolve(userObjToReturn2);
        }
      }).catch(function(error){
          logger.log("error",logger.logErrorReport("ERROR","/1.0/getUsedUserContact@1218",[error]));
          deferred.reject();
      });
    }
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getUsedUserContact@1223",[e]));
    deferred.reject();
  }
  return deferred.promise;
};

exports.payNegativeCredits = function(_creditCardToken,_userId)
{
  const deferred = Q.defer();
  var checkoutCustomerId = "NIL";
  var userCreditCardToken = "NIL";
  var userCreditCardUID = "NIL";
  var _userFoundAt = "SGP";
  var _userContact = -1;
  var _userSGPCredits = 0;
  var _userMYSCredits = 0;
  var _userSelectCredits = 0;
  var transactionId = "NIL";
  var maskedCreditCard = "NIL";
  var creditCardType = "NIL";
  const db = dbUtil.admin.database();
  try {
    var usersRef = db.ref("Users").child(_userId);
    var transactionRef = db.ref("Transactions").child(_userId);
    usersRef.once("value").then(function(snapshot){
      var exists = snapshot.exists();
      if (!exists)
      {
        throw(logger.logErrorReport("ERROR","/1.0/payNegativeCredits@1644",[_creditCardToken,_userId]));
      }
      else {
        _userSGPCredits = snapshot.child("SGPCredits").exists() ? parseInt(snapshot.val()["SGPCredits"]) : 0;
        _userMYSCredits = snapshot.child("MYSCredits").exists() ? parseInt(snapshot.val()["MYSCredits"]) : 0;
        checkoutCustomerId = snapshot.child("customerId").exists() ? snapshot.val()["customerId"] : "NIL";
        userCreditCardToken = snapshot.child("creditCardToken").exists() ? snapshot.val()["creditCardToken"] : "NIL";
        userCreditCardUID = snapshot.child("creditCardUID").exists() ? snapshot.val()["creditCardUID"] : "NIL";
        _userFoundAt = snapshot.child("userFoundAt").exists() ? snapshot.val()["userFoundAt"]  : "SGP";
        _userFoundAt = _userFoundAt == "MYS" ? "MYS" : "SGP"; //currently the places we serve
        _userContact = snapshot.child("contact").exists() ? parseInt(snapshot.val()["contact"]) : -1;
        var _merchantAccountId = _userFoundAt == "MYS" ? "telepodMYR": _userSelectCredits >= -1200 ?
        "telepodpteltdSGD" : "telepodSGD"; //braintree account to wire
        _userSelectCredits = _userFoundAt == "MYS" ? _userMYSCredits : _userSGPCredits;
        if(_userSelectCredits < 0)
        { // only pay if credit is negative...
          var brainTreeCostPrice = ((_userSelectCredits * -1)/100).toFixed(2);
          return gateway.transaction.sale({
          amount: brainTreeCostPrice,
          paymentMethodToken: _creditCardToken,
          merchantAccountId:_merchantAccountId,
          customFields: {
            userid: _userId
          },
          options: {
            storeInVaultOnSuccess: true,
            submitForSettlement: true
            }
          });
        }
        else {
          deferred.resolve({"status":"OK"});
        }
      }
    }).then(function(handleSuccessfulTransaction){
      if(handleSuccessfulTransaction.success)
      {
        transactionId = handleSuccessfulTransaction.transaction.id;
        checkoutCustomerId = handleSuccessfulTransaction.transaction.customer.id;
        maskedCreditCard = handleSuccessfulTransaction.transaction.creditCard.maskedNumber;
        creditCardType = handleSuccessfulTransaction.transaction.creditCard.cardType;
        userCreditCardUID = handleSuccessfulTransaction.transaction.creditCard.uniqueNumberIdentifier;
        userCreditCardToken = handleSuccessfulTransaction.transaction.creditCard.token;
        return transactionRef.once("value");
      }
      else
      {
        var _transactionStatus = handleSuccessfulTransaction.status != null && 
        handleSuccessfulTransaction.status != undefined ? handleSuccessfulTransaction.status : "NIL";
        var _transactionResponseCode = handleSuccessfulTransaction.processorResponseCode != null &&
          handleSuccessfulTransaction.processorResponseCode != undefined ?
          handleSuccessfulTransaction.processorResponseCode : "NIL";
        var _transactionResponseText = handleSuccessfulTransaction.processorResponseText != null &&
          handleSuccessfulTransaction.processorResponseText != undefined ?
          handleSuccessfulTransaction.processorResponseText : "NIL";
        throw(logger.logErrorReport("ERROR","/1.0/payNegativeCredits@1699",[_creditCardToken,_userId,
          _transactionStatus,_transactionResponseCode,_transactionResponseText]));
      }
    }).then(function(transOBJ){
      var transactionOBJ = {};
      transactionOBJ["paymentTime"] = parseInt(new Date().getTime()/1000);
      transactionOBJ["paymentAmount"] = parseInt(_userSelectCredits*-1);
      transactionOBJ["creditCardNumber"] = maskedCreditCard;
      transactionOBJ["creditCardType"] = creditCardType;
      transactionOBJ["creditCardToken"] = userCreditCardToken;
      transactionOBJ["userFoundAt"] = _userFoundAt;
      transactionOBJ["paymentType"] = 1;
      transactionOBJ["passLevel"] = -1;
      transactionOBJ["passId"] = "NIL";
      transactionOBJ["isRecurring"] = false;
      transactionOBJ["hasExpired"] = false;

      if(_userFoundAt == "MYS")
      {
        usersRef.update({"MYSCredits":0,"creditCardType":creditCardType,
          "creditCardNumber":maskedCreditCard,"creditCardToken":userCreditCardToken,
          "customerId":checkoutCustomerId,"creditCardUID":userCreditCardUID}).then(function(){
            return transactionRef.child(transactionId).update(transactionOBJ);
        }).catch(function(err){
          logger.log("error",logger.logErrorReport("ERROR_DB_WRITING","/1.0/payNegativeCredits@1723",[err,userId,amount]));
        });
      }
      else {
        usersRef.update({"SGPCredits":0,"creditCardType":creditCardType,
          "creditCardNumber":maskedCreditCard,"creditCardToken":userCreditCardToken,
          "customerId":checkoutCustomerId,"creditCardUID":userCreditCardUID}).then(function(){
            return transactionRef.child(transactionId).update(transactionOBJ);
        }).catch(function(err){
          logger.log("error",logger.logErrorReport("ERROR_DB_WRITING","/1.0/payNegativeCredits@1732",[err,userId,amount]));
        });
    }
    deferred.resolve({"status":"OK"});
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/payNegativeCredits@1737",[err]));
    deferred.reject();
  });
  } catch (e) {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/payNegativeCredits@1741",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.getScootersInStation = function(_accountGroup,stationId,_scooterStatus)
{
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  var arrayToReturn = [];
  try{
    var gpsRef = db.ref("GPS").orderByChild("accountGroup").equalTo(_accountGroup);
    gpsRef.once("value").then(function(snapshot){
      if (!snapshot.exists())
      {
        deferred.resolve(arrayToReturn);
      }
      else {
        snapshot.forEach(function(scooterobj){
          var _GPSObj = new gpsModel();
          Object.assign(_GPSObj,scooterobj.val(),{"IMEI":scooterobj.ref.key});
          if(_GPSObj.stationId === stationId && _GPSObj.stationId === _scooterStatus)
          {
            arrayToReturn.push(_GPSObj); 
          }
        });
        deferred.resolve(arrayToReturn);
      }
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getScootersInStation@1774",[err]));
      deferred.reject();
    });

  }catch(e)
  {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/getScootersInStation@1780",[e]));
    deferred.reject();
  }
  return deferred.promise;
}

exports.checkUserReferral = function(userId,refId,_accountGroup)
{
	const deferred = Q.defer();
  const db = dbUtil.admin.database();
  
  const userRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Users") :  db.ref(_accountGroup).child("Users");
  const transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Transactions") :  db.ref(_accountGroup).child("Transactions");
  var _timenow = new Date().getTime();
  var _referrerUserObj = new userModel();
  var _refereeUserObj = new userModel();

  try
  {
    var promises = [userRef.child(userId).once("value"),
      userRef.child(refId).once("value"),
      transactionRef.child(userId).child(refId).once("value")];

    Q.all(promises).then(function(tell){
      if(tell[0].exists() && tell[1].exists())
      {
        Object.assign(_refereeUserObj,tell[0].val(),{"userId":userId});
        Object.assign(_referrerUserObj,tell[1].val(),{"userId":refId});
        if(_referrerUserObj.tripCount !== 0 || ((_timenow - _referrerUserObj.registrationDate) > 21600000)) //6 Hours old account OR tripcount more than 0
        {
          throw(logger.logErrorReport("ERROR_EXISTING_USER","/1.0/checkUserReferral@1879",[userId,refId]));
        }
        else if(tell[2].exists())
        {
          throw(logger.logErrorReport("ERROR_REFID_EXISTED","/1.0/checkUserReferral@1883",[userId,refId]));
        }
        else if(!_refereeUserObj.authenticated || !_referrerUserObj.authenticated || (_refereeUserObj.contact === _referrerUserObj.contact)) //to combat lobang-king...
        {
          throw(logger.logErrorReport("ERROR_DUPLICATE_CONTACT","/1.0/checkUserReferral@1887",[userId,refId]));
        }
        else {
          var _refereeTransactionObjNew = new transactionModel();
          Object.assign(_refereeTransactionObjNew,{
            "creditCardType":refId,
            "creditCardNumber":"REFER",
            "hasExpired":false,
            "paymentAmount":300,
            "country":_refereeUserObj.country,
            "currency":_refereeUserObj.currency
          });
          return transactionRef.child(userId).child(refId).update(_refereeTransactionObjNew);
        }
      }
      else {
        throw(logger.logErrorReport("ERROR","/1.0/checkUserReferral@1907",[userId,refId]));
      }
    }).then(function(){ // update user's object
      Object.assign(_refereeUserObj,{"credits":_refereeUserObj.credits + 300}) // add 3.00 to credits
      return userRef.child(userId).update(_refereeUserObj)
    }).then(function(){
      var _referrerTransactionObjNew = new transactionModel();
      Object.assign(_referrerTransactionObjNew,{
        "creditCardType":userId,
        "creditCardNumber":"REFERRED",
        "hasExpired":false,
        "paymentAmount":200,
        "country":_referrerUserObj.country,
        "currency":_referrerUserObj.currency
      });
      return transactionRef.child(refId).child(userId).update(_referrerTransactionObjNew);
    }).then(function(){
      Object.assign(_referrerUserObj,{"credits":_referrerUserObj.credits + 200}) // add 2.00 to credits
      return userRef.child(refId).update(_referrerUserObj)
    }).then(function(){
      deferred.resolve({"status":"OK"});
    }).catch(function(e){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/checkUserReferral@1953",[e]));
      deferred.reject();
    });
  }
  catch(e)
  {
    logger.log("error",logger.logErrorReport("ERROR","/1.0/checkUserReferral@1959",[e]));
    deferred.reject();
  }
    return deferred.promise;
};

exports.convertUserDepositToCredit = function(userId,_accountGroup)
{
	const deferred = Q.defer();
  var db = dbUtil.admin.database();
  var _userObj = new userModel();
  const transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Transactions") : db.ref(_accountGroup).child("Transactions");
  const _nowTime = new Date().getTime();
  dd.getUserOBJ(userId,_accountGroup).then(function(userObjRecv){
    Object.assign(_userObj,userObjRecv)
    if(_userObj.creditCardToken === "NIL" || _userObj.deposit <= 0)
    {
      throw(logger.logErrorReport("ERROR","/1.0/convertUserDepositToCredit@1981",[userId]));
    }
    var _newUserCredits = _userObj.credits + _userObj.deposit;
    return dd.setUserOBJ(userId,{"deposit":parseInt(0),"credits":parseInt(_newUserCredits)},_accountGroup);
  }).then(function(){
    var _newTransactionOBj = new transactionModel();
    Object.assign(_newTransactionOBj,{
      "creditCardType":"CONVERSION",
      "creditCardNumber":"CONVERT-DEPOSIT-CREDIT",
      "hasExpired":false,
      "paymentAmount":4900,
      "country":_userObj.country,
      "currency":_userObj.currency
    });
    return transactionRef.child(userId).child(_nowTime).update(_newTransactionOBj);
  }).then(function(){
    deferred.resolve({"status":"OK"});
  }).catch(function(err){
		logger.log("error",logger.logErrorReport("ERROR","/1.0/convertUserDepositToCredit@2010",[err]));
		deferred.reject();
	});

	return deferred.promise;
}

/* exports.createScooterReport = function(_userId,_scooterId,_locationUser,_message,_typeOfIssue){
  const deferred = Q.defer();
  const db = dbUtil.admin.database();
  const scooterReportsRef = db.ref("ScootersReports");
  const nowTime = parseInt((new Date().getTime())/1000);

  var outerShell = {};
  var innerShell = {};
  innerShell["userId"] = _userId;
  innerShell["scooterId"] = _scooterId;
  innerShell["locationUser"] = _locationUser;
  innerShell["message"] = _message;
  innerShell["typeOfIssue"] = _typeOfIssue;

  outerShell[nowTime] = innerShell;

  scooterReportsRef.update(outerShell).then(function(){
    deferred.resolve({"status":"OK"});
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/createScooterReport@2036",[err]));
    deferred.reject();
  })

  return deferred.promise;
}
 */
/* exports.getNearbyStations = function(radiusKM,stationLocation){
  const deferred = Q.defer();
  const db = dbUtil.admin3.database();
  const stationRef = db.ref("StationsGeoFire");
  const geoFire = new GeoFire(stationRef);
  var arr = [];

  var geoQuery = geoFire.query({
    center: [parseFloat(stationLocation[0]),parseFloat(stationLocation[1])],
    radius: radiusKM
  });

  geoQuery.on("key_entered", function(key, location, distance) {
    arr.push({"stationId":key,"distance":distance*1000});
  });

  geoQuery.on("ready", function() {
    geoQuery.cancel();
    var arrayToReturn = [];
    var promiseToReturn = [];
    var arrayToProcess = [];

    arr.sort(function(a,b){return a.distance - b.distance});
    arr.forEach(function(item,index){
      arrayToProcess.push(item.stationId);
    });

    dd.getUserStations().then(function(arr2)
    {
      arr2.forEach(function(item,index){
        if(arrayToProcess.includes(item.stationId))
        {
          var arrayIndexNum = arrayToProcess.indexOf(item.stationId);

          Object.assign(item, {"distance":arr[arrayIndexNum].distance});
          arrayToReturn.push(item);
        }
        promiseToReturn.push(deferred.promise);
      });
    }).catch(function(err){
      logger.catchFunc(ip,"ERROR","/1.0/getNearbyStations@2083",res,204,"");
    });

    Q.all(promiseToReturn).then(function(){
      arrayToReturn.sort(function(a,b){return a.distance - b.distance});
      deferred.resolve(arrayToReturn);
    }).catch(function(err){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/getNearbyStations@2090",["NIL"]));
      deferred.reject();
    });
  });
  return deferred.promise;
} */

/* exports.getUserStations = function()
{
  const deferred = Q.defer();
  var stationToRet = [];
  
	const stationGlobal = dbUtil.getStation3Global();
  const stationList = dbUtil.getUserStations3Global();

  for(var stationKey in stationGlobal)
  {
    if(stationList.includes(stationKey))
    {
      var stationObjectToStore = {};

			stationObjectToStore["stationId"] = stationKey;
			stationObjectToStore["Lat"] = stationGlobal[stationKey]["l"][0];
			stationObjectToStore["Lng"] = stationGlobal[stationKey]["l"][1];
			stationObjectToStore["dockingAvail"] = stationGlobal[stationKey]["dockingAvail"];
			stationObjectToStore["scooterAvail"] = stationGlobal[stationKey]["scooterAvail"];
			stationObjectToStore["scooterBatteryLow"] = stationGlobal[stationKey]["scooterBatteryLow"];
			stationObjectToStore["stationName"] = stationGlobal[stationKey]["stationName"];
      stationObjectToStore["subStationName"] = (stationGlobal[stationKey]["stationName"] === undefined) ? "NIL" : stationGlobal[stationKey]["subStationName"];
      stationObjectToStore["img"] = (stationGlobal[stationKey]["img"] === undefined) ? [] : stationGlobal[stationKey]["img"];
      stationObjectToStore["vrImg"] = (stationGlobal[stationKey]["vrImg"] === undefined) ? [] : stationGlobal[stationKey]["vrImg"];

      stationToRet.push(stationObjectToStore);
    }
  }
  deferred.resolve(stationToRet);
  return deferred.promise;
} */

exports.setRefundReasons = function(userId,arrayRefundComment,_accountGroup)
{
	var deferred = Q.defer();
	var db = dbUtil.admin.database();
  var tripRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Refunds").child(userId).child(new Date().getTime()) : 
    db.ref(_accountGroup).child("Refunds").child(userId).child(new Date().getTime());

  tripRef.set(arrayRefundComment).then(function(){
    deferred.resolve({"status":"OK"});
  }).catch(function(err){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/setRefundReasons@2140",[err,userId,arrayRefundComment]));
    deferred.reject();
  });

	return deferred.promise;
};

exports.getUserTransactions = function(userId,_limit,_accountGroup)
{
	const deferred = Q.defer();
	const db = dbUtil.admin.database();
  var transactionRef = _accountGroup === undefined || _accountGroup === "NIL" ? 
    db.ref("Transactions").child(userId) : db.ref(_accountGroup).child("Transactions").child(userId);
  var userTransactionToReturn = [];

	transactionRef.limitToLast(_limit).once("value").then(function(snapshot)
	{
		if(!snapshot.exists())
		{
      throw(logger.logErrorReport("ERROR_NOT_FOUND","/1.0/getUserTransactions@2160",[userId]));
		}
    else {
      snapshot.forEach(function(innerSnapShot){
        var _transactionObj = new transactionModel();
        Object.assign(_transactionObj,innerSnapShot.val(),{
          "transactionId": innerSnapShot.ref.key
        });
        userTransactionToReturn.push(_transactionObj);
      });
      deferred.resolve(userTransactionToReturn);
    }
  }).catch(function(error){
      logger.log("error",error);
      deferred.reject(error);
  });
    return deferred.promise;
};