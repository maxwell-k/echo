var zipFolder = require('zip-folder');
var path = require('path');
var fs = require('fs');
var request = require('request');

var rootFolder = path.resolve('.');
var zipPath = path.resolve(rootFolder, '../demo-bot-ksyws.zip');
var kuduApi = 'https://demo-bot-ksyws.scm.azurewebsites.net/api/zip/site/wwwroot';
var userName = '$demo-bot-ksyws';
var password = 'aGeyPWwEdQfpBLelXhvngf0uXfANNHHmeHWkvlM3kDzv36jTzXflMba6GtEX';

function uploadZip(callback) {
  fs.createReadStream(zipPath).pipe(request.put(kuduApi, {
    auth: {
      username: userName,
      password: password,
      sendImmediately: true
    },
    headers: {
      "Content-Type": "applicaton/zip"
    }
  }))
  .on('response', function(resp){
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      fs.unlink(zipPath);
      callback(null);
    } else if (resp.statusCode >= 400) {
      callback(resp);
    }
  })
  .on('error', function(err) {
    callback(err)
  });
}

function publish(callback) {
  zipFolder(rootFolder, zipPath, function(err) {
    if (!err) {
      uploadZip(callback);
    } else {
      callback(err);
    }
  })
}

publish(function(err) {
  if (!err) {
    console.log('demo-bot-ksyws publish');
  } else {
    console.error('failed to publish demo-bot-ksyws', err);
  }
});