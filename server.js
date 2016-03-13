//variable declaration for application

//HTTP module provides server and client functionality
var http = require('http');
//fs module provides file system related functionality
var fs = require('fs');
//path module provides file system path-related functionality
var path = require('path');
//mime module provides ability to derive MIME type based on file extension
var mime = require('mime');
// cache object where contents of cached file are stored
var cache = {};

//handles sending 404 error when requested file does not exist
function send404(response) {
	response.writeHead(404, {'Content-Type': 'text/plain'});
	response.write('Error 404: resource not found.');
	response.end();
}

//writes the appropriate HTTP headers and sends the content of the file
function sendFile(response, filePath, fileContents) {
	response.writeHead( 200, { "content-type": mime.lookup(path.basename(filePath))} );
	response.end(fileContents);
}

//serving static files
function serveStatic(response, cache, absPath) {
	//checks if files is already cached
	if (cache[absPath]) {
		//file cached already before & calling sendFile() to set HTTP header
		sendFile(response, absPath, cache[absPath]);
	} else {
		//check if file exists
		fs.exists(absPath, function(exists) {
			if (exists) {
				//reads file content
				fs.readFile(absPath, function(err, data) {
					if (err) {
						//handle error if any
						send404(response);
					} else {
						//cache file content and call sendFile() to set HTTP header
						cache[absPath] = data;
						sendFile(response, absPath, data);
					}
				});
			} else {
				send404(response);
			}
		});
	}
}

//logic to create HTTP server
var server = http.createServer(function(request, response) {
	var filePath = false;

	if (request.url == '/') {
		filePath = 'public/index.html';
	} else {
		filePath = 'public' + request.url;
	}

	var absPath = './' + filePath;

	serveStatic(response, cache, absPath);
});

//start HTTP server using port 3000
server.listen(5000, function() {
	console.log("Server listening on port 5000.");
});

//load socket.io custom module to handle server side chat functionality
var chatServer = require('./lib/chat_server');
chatServer.listen(server);

