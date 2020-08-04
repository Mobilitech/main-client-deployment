'use strict';
var Q = require('q');
var telepodDetails = app_require('telepod_details');
var logger = app_require('util/loggerUtil.js');
var request = require('request-json');
var DBController = app_require('versions/1.0/DBController.js');

var FCMOpsModel = app_require('versions/1.0/Model/FCMOperation.js');

exports.gpsHighRelayCommand = function(_accountGroup,scooterId)
{
  var deferred = Q.defer();
  DBController.getScooterOBJ(_accountGroup,scooterId).then(function(scooterObj){
    var _connectedHost = scooterObj.connectedHost;
    var _imei = scooterObj.IMEI;
    if(_connectedHost != undefined && _connectedHost != null && _connectedHost != "NIL")
    {
      var client = request.createClient("http://"+_connectedHost+":3000/");
      return client.get('OnGPSRelay?IMEI=' + _imei);
    }
    else {
      throw(logger.logErrorReport("ERROR","/1.0/gpsHighRelayCommand@20",[scooterId,_imei]));
    }
  }).then(function(){
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsHighRelayCommand@23",[scooterId]));
  }).catch(function(e){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/gpsHighRelayCommand@25",[e]));
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsHighRelayCommand@26",[scooterId]));
  });

    return deferred.promise;
};

exports.gpsLowRelayCommand = function(_accountGroup,scooterId)
{
    var deferred = Q.defer();

    DBController.getScooterOBJ(_accountGroup,scooterId).then(function(scooterObj){
      var _connectedHost = scooterObj.connectedHost;
      var _imei = scooterObj.IMEI;
      if(_connectedHost != undefined && _connectedHost != null && _connectedHost != "NIL")
      {
        var client = request.createClient("http://"+_connectedHost+":3000/");
        return client.get('OffGPSRelay?IMEI=' + _imei)
      }
      else {
        throw(logger.logErrorReport("ERROR","/1.0/gpsLowRelayCommand@68",[scooterId,_imei]));
      }
    }).then(function(){
      deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLowRelayCommand@71",[scooterId]));
    }).catch(function(e){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/gpsLowRelayCommand@73",[e]));
      deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLowRelayCommand@74",[scooterId]));
    });

    return deferred.promise;
};

exports.buzzerOn = function(_accountGroup,scooterId)
{
    var deferred = Q.defer();

    DBController.getScooterOBJ(_accountGroup,scooterId).then(function(scooterObj){
      var _connectedHost = scooterObj.connectedHost;
      var _imei = scooterObj.IMEI;
      if(_connectedHost != undefined && _connectedHost != null && _connectedHost != "NIL")
      {
        var client = request.createClient("http://"+_connectedHost+":3000/");
        return client.get('buzzerOn?IMEI=' + _imei);
      }
      else {
        throw(logger.logErrorReport("ERROR","/1.0/buzzerOn@92",[scooterId,_imei]));
      }
    }).then(function(){
      deferred.resolve(logger.logErrorReport("OK","/1.0/buzzerOn@95",[scooterId]));
    }).catch(function(e){
      logger.log("error",logger.logErrorReport("ERROR","/1.0/buzzerOn@97",[e]));
      deferred.resolve(logger.logErrorReport("OK","/1.0/buzzerOn@98",[scooterId]));
    });

    return deferred.promise;
};

exports.gpsLightOff = function(_accountGroup,scooterId) //GEN 3
{
  const deferred = Q.defer();
  DBController.getScooterOBJ(_accountGroup,scooterId).then(function(scooterObj){
    var _connectedHost = scooterObj.connectedHost;
    if(_connectedHost != undefined && _connectedHost != null && _connectedHost != "NIL")
    {
      var client = request.createClient("http://"+_connectedHost+":3000/");
      return client.get('lightOff?scooterId=' + scooterId);
    }
    else {
      throw(logger.logErrorReport("ERROR","/1.0/gpsLightOff@198",[scooterId]));
    }
  }).then(function(){
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLightOff@201",[scooterId]));
  }).catch(function(e){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/gpsLightOff@203",[e]));
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLightOff@204",[scooterId]));
  });
    return deferred.promise;
};

exports.gpsLightOn = function(_accountGroup,scooterId) //GEN 3
{
  const deferred = Q.defer();
  DBController.getScooterOBJ(_accountGroup,scooterId).then(function(scooterObj){
    var _connectedHost = scooterObj.connectedHost;
    if(_connectedHost != undefined && _connectedHost != null && _connectedHost != "NIL")
    {
      var client = request.createClient("http://"+_connectedHost+":3000/");
      return client.get('lightOn?scooterId=' + scooterId);
    }
    else {
      throw(logger.logErrorReport("ERROR","/1.0/gpsLightOn@220",[scooterId]));
    }
  }).then(function(){
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLightOn@223",[scooterId]));
  }).catch(function(e){
    logger.log("error",logger.logErrorReport("ERROR","/1.0/gpsLightOn@225",[e]));
    deferred.resolve(logger.logErrorReport("OK","/1.0/gpsLightOn@226",[scooterId]));
  });
    return deferred.promise;
};


exports.createFCMDeviceGroup = function(_accountGroup,_arrayOfRegistrationId)
{
  var deferred = Q.defer();
  var timeout = setTimeout(function() {
    logger.log("info",logger.logErrorReport("ERROR_TIMEOUT","/1.0/createFCMDeviceGroup@280",[_accountGroup,_arrayOfRegistrationId]));
    deferred.reject();
  }, 10000);

  try {
    var client = request.createClient(telepodDetails.fcmDomain);
    client.headers['Authorization'] = 'key=' + telepodDetails.FCMServerKey;
    client.headers['Content-Type'] = "application/json";
    client.headers['project_id'] = telepodDetails.FCMSenderId;
    var operationObj = new FCMOpsModel();
    Object.assign(operationObj,{
      "notification_key_name":_accountGroup,
      "registration_ids":_arrayOfRegistrationId
    });
    client.post('notification',operationObj).then(function(objreply){
      clearTimeout(timeout);
      if(objreply.res.statusCode >= 300)
      {
        deferred.reject();
      }
      else if (objreply.res.statusCode < 300 && objreply.res.statusCode >= 200){
        deferred.resolve(objreply.body);
      }
      else {
        deferred.reject();
      }
    }).catch(function(error){
      clearTimeout(timeout);
      throw(logger.logErrorReport("ERROR","/1.0/createFCMDeviceGroup@309",[error]));
    });
  } catch (e) {
    clearTimeout(timeout);
    logger.log("error",logger.logErrorReport("ERROR","/1.0/createFCMDeviceGroup@313",[e]));
    deferred.reject();
  }

  return deferred.promise;
}

exports.addFCMTokenToDeviceGroup = function(_accountGroup,_accountGroupToken,_arrayOfRegistrationId)
{
  var deferred = Q.defer();
  var timeout = setTimeout(function() {
    logger.log("info",logger.logErrorReport("ERROR_TIMEOUT","/1.0/addFCMTokenToDeviceGroup@324",[_accountGroup,_arrayOfRegistrationId]));
    deferred.reject();
  }, 10000);

  try {
    var client = request.createClient(telepodDetails.fcmDomain);
    client.headers['Authorization'] = 'key=' + telepodDetails.FCMServerKey;
    client.headers['Content-Type'] = "application/json";
    client.headers['project_id'] = telepodDetails.FCMSenderId;
    var operationObj = new FCMOpsModel();
    Object.assign(operationObj,{
      "operation":"add",
      "notification_key_name":_accountGroup,
      "notification_key":_accountGroupToken,
      "registration_ids":_arrayOfRegistrationId
    });
    client.post('notification',operationObj).then(function(objreply){
      clearTimeout(timeout);
      if(objreply.res.statusCode >= 300)
      {
        deferred.reject();
      }
      else if (objreply.res.statusCode < 300 && objreply.res.statusCode >= 200){
        deferred.resolve(objreply.body);
      }
      else {
        deferred.reject();
      }
    }).catch(function(error){
      clearTimeout(timeout);
      throw(logger.logErrorReport("ERROR","/1.0/addFCMTokenToDeviceGroup@354",[error]));
    });
  } catch (e) {
    clearTimeout(timeout);
    logger.log("error",logger.logErrorReport("ERROR","/1.0/addFCMTokenToDeviceGroup@358",[e]));
    deferred.reject();
  }

  return deferred.promise;
}