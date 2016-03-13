//allow use of socket.io
var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

//on() act as listener/reader and emit() act as writer
exports.listen = function(server) {
	//start socket.io server and allow it to piggyback on existing HTTP server
	io = socketio.listen(server);
	io.set('log level', 1);

	//defines how each user connection will be handled
	io.sockets.on('connection', function (socket) {
		//assign user a guest name when they connect
		guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

		//place user in lobby room when they connect
		joinRoom(socket, 'Lobby');

		//handle user messages, name-change attempt and room creation/changes
		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);

		//provide user with list of occupied rooms on request
		socket.on('rooms', function() {
			socket.emit('rooms', io.sockets.manager.rooms);
		});

		//define clean up logic for when user disconnects
		handleClientDisconnection(socket, nickNames, namesUsed);
	});
};

//assign guest name 'Guest<number>' when user connects initially put in 'lobby' room
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
	var name = 'Guest' + guestNumber;

	//assign guest name with client connection id
	nickNames[socket.id] = name;

	//let user know their guest name
	socket.emit('nameResult', {
		success: true,
		name: name
	});

	namesUsed.push(name);

	return guestNumber + 1;
}

//user joins the room & lets the user know what other users are in the room and lets these other users know that the user is now present.
function joinRoom(socket, room) {
	//make user join room
	socket.join(room);

	//user is now in that room
	currentRoom[socket.id] = room;

	//let user know they're in new room
	socket.emit('joinResult', {room: room});

	//let other users in room know that user has joined
	socket.broadcast.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});

	//determine what other users are in same room as user
	var usersInRoom = io.sockets.clients(room);

	//if other users exist, summarize who they are
	if (usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ': ';

		for (var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if (userSocketId != socket.id) {
				if (index > 0) {
				usersInRoomSummary += ', ';
				}
				usersInRoomSummary += nickNames[userSocketId];
			}
		}

		usersInRoomSummary += '.';

		//send summary of other users in the room to the user
		socket.emit('message', {text: usersInRoomSummary});
	}
}

//handle name change request
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	//Add listener for nameAttempt events
	socket.on('nameAttempt', function(name) {
		//Don’t allow nicknames to begin with 'Guest'
		if (name.indexOf('Guest') == 0) {
			socket.emit('nameResult', {
				success: false,
				message: 'Names cannot begin with "Guest".'
			});
		} else {
			//If name isn’t already registered, register it
			if (namesUsed.indexOf(name) == -1) {
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;

				//If name isn’t already registered, register it
				delete namesUsed[previousNameIndex];

				socket.emit('nameResult', {
					success: true,
					name: name
				});

				socket.broadcast.to(currentRoom[socket.id]).emit('message', {
					text: previousName + ' is now known as ' + name + '.'
				});
			} else {
				//Send error to client if name is already registered
				socket.emit('nameResult', {
					success: false,
					message: 'That name is already in use.'
				});
			}
		}
	});
}

//sending chat messages
function handleMessageBroadcasting(socket) {
	socket.on('message', function (message) {
		//broadcast function is used to relay the message
		socket.broadcast.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}

//allows a user to join an existing room or, if it doesn’t yet exist, to create it
function handleRoomJoining(socket) {
	socket.on('join', function(room) {
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	});
}

//handling user disconnections
function handleClientDisconnection(socket) {
	socket.on('disconnect', function() {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	});
}

