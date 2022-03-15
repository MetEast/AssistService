#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var http = require('http');

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
    
    webSocketConnection = request.accept(request.origin);
    console.log((new Date()) + ' Connection accepted.');
    webSocketConnection.on('message', function(message) {
       
    });

    function sendCheckData() {
      if(webSocketConnection != null) {
        webSocketConnection.send(JSON.stringify({type: 'status', data: 1}));
      }
      setTimeout(sendCheckData, 1000);
    }
    sendCheckData();

    webSocketConnection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + webSocketConnection.remoteAddress + ' disconnected.');
    });
});

module.exports = {
  sendData: function (data) {
    webSocketConnection.send(JSON.stringify(data));
  }
}
