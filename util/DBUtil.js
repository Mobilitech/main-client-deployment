const admin = require("firebase-admin");
const serviceAccount = app_require("serviceAccountKey.json");
const serviceAccount2 = app_require('serviceAccountKey2.json');
const serviceAccount3 = app_require("serviceAccountKey3.json");
const telepodDetails = app_require("telepod_details.js");
const dbUtil = app_require('util/DBUtil.js');

var projectGroupGlobal = [];
var databaseInitialized = false;

//User/Trips/Transactions FirebaseDB
exports.admin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: telepodDetails.databaseURL
});

//Action-Logging FirebaseDB
exports.admin2 = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount2),
  databaseURL: telepodDetails.databaseURL2
},'secondDB');

//Station/Zone FirebaseDB
exports.admin3 = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount3),
  databaseURL: telepodDetails.databaseURL3
},'thirdDB');


exports.init = function()
{
  if(!databaseInitialized)
  {
    const db = dbUtil.admin.database();
    const projectGroupsRef = db.ref("ProjectGroups");

    projectGroupsRef.once("value").then(function(snapshot)
    {
      snapshot.forEach(function(_projectObj){
        var _accountGroupId = _projectObj.ref.key;
        var resultZone = {};
        Object.assign(resultZone, _projectObj.val(), {"accountGroup":_accountGroupId});
        dbUtil.setAccountGroupObj(resultZone);
      });
    });

    projectGroupsRef.on("child_changed",_projectGroupOnChanged);

    databaseInitialized = true;
  }
};

exports.setAccountGroupObj = function(_accountGroupObj){
  projectGroupGlobal.push(_accountGroupObj);
}
/////////////// END OF SET OPS////////////////////////////
/////////////// START OF GET OPS////////////////////////////
exports.getAccountGroups = function()
{
  return projectGroupGlobal;
}

function _projectGroupOnChanged(childSnapShot)
{
  var _accountGroupId = childSnapShot.ref.key;
  for (var i = projectGroupGlobal.length - 1; i >= 0; i--)
  {
    if(projectGroupGlobal[i].accountGroup === _accountGroupId)
    {
      projectGroupGlobal.splice(i,1);
    }
  }
  var resultZone = {};
  Object.assign(resultZone, childSnapShot.val(), {"accountGroup":_accountGroupId});
  dbUtil.setAccountGroupObj(resultZone);
}
