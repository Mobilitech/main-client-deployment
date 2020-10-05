var mysql = require('mysql');
var fs = require('fs');

var conn = mysql.createConnection({
user : 'byron',
password : 'm69iicuhtqmifvmk',
host : 'tryke-analytics-database-do-user-7742253-0.a.db.ondigitalocean.com',
port : 25060,
database : 'defaultdb',
sslmode : 'REQUIRED',
multipleStatements: true,
charset : 'utf8mb4',

});
conn.connect(function(err) {
if (err) throw err;
console.log('Database is connected successfully !');

});

module.exports = conn;