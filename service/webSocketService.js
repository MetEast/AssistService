#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var http = require('http');

let stickerDBService = require('./stickerDBService');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

var webSocketConnection = null;

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    webSocketConnection = request.accept();
    console.log((new Date()) + ' Connection accepted.');
    webSocketConnection.on('message', function(message) {
      
    });

    webSocketConnection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + webSocketConnection.remoteAddress + ' disconnected.');
    });
});

async function sendData(title, context, to) {
  stickerDBService.createNewNotification(title, context, to).then((id) => {
    if(id == null) {
      return;
    }
    let data = {
      type: 'alert',
      id: id,
      title: title,
      context: context,
      to: to,
    }
    if(webSocketConnection != null) {
      webSocketConnection.send(JSON.stringify(data));
    }
  }).catch(error => {
    console.log(error);
  })
}

client.on('connectFailed', function(error) {
  console.log('Connect Error: ' + error.toString());
  client.connect('ws://localhost:8081/');
});

client.on('connect', function(connection) {
  console.log('WebSocket Client Connected');
  connection.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
      client.connect('ws://localhost:8081/');
  });
  connection.on('close', function() {
      console.log('echo-protocol Connection Closed');
      client.connect('ws://localhost:8081/');
  });
  connection.on('message', function(message) {
      if (message.type === 'utf8') {
        let data = message.utf8Data;
        let jsonData = JSON.parse(data);
        if(jsonData.type == "metbackend") {
          sendData(jsonData.title, jsonData.context, jsonData.to);
        }
        console.log("Received: '" + message.utf8Data + "'");
      }
  });
  
  
});

client.connect('ws://localhost:8081/');

module.exports = {
  makeSocketData: function (title, context, to) {
    sendData(title, context, to);
  }
}
