const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);


const rooms = new Map();


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function createRoom() {
  let roomId;
  do {
    roomId = Math.floor(100000 + Math.random() * 900000).toString(); 
  } while (rooms.has(roomId));

  rooms.set(roomId, new Map());
  console.log(`Room created: ${roomId}`);
  return roomId;
}

// 2️⃣ Join Room
function joinRoom(roomId, socketId, username) {
  if (!rooms.has(roomId)) {
    throw new Error("Room not found!");
  }
  const users = rooms.get(roomId);
  users.set(socketId, username);
  console.log(`${username} joined room ${roomId}`);
}

// 3️⃣ Delete Room
function deleteRoom(roomId) {
  if (rooms.has(roomId)) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  } else {
    console.log(`Room ${roomId} does not exist`);
  }
}
// 💡 Helper: Remove user when disconnects
function removeUser(socketId) {
  for (const [roomId, users] of rooms.entries()) {
    if (users.has(socketId)) {
      const username = users.get(socketId);
      users.delete(socketId);
      console.log(`${username} left room ${roomId}`);

      // If room is empty, delete it automatically
      if (users.size === 0) {
        deleteRoom(roomId);
      }

      return { roomId, username };
    }
  }
  return null;
}

// Setup socket.io with CORS enabled for all origins
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- Setup EJS view engine ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (like client.js)
app.use(express.static(path.join(__dirname, "public")));

// Route for home page
app.get("/", (req, res) => {
  res.render("index");
});




// app.get("/Join/:roomNo/:Name", (req, res) => {
//   const { roomNo, Name} = req.params;
// });
// app.get("/code/:roomNo/:Name", (req, res) => {
//    const roomNo = req.params.roomNo;
    
//     const userName = req.params.Name;
//         res.render("code", { 
//         roomNo: roomNo, 
//         userName: userName 
//     });
// })
app.post("/code", (req, res) => {
    const roomNo = req.body.roomNo;
    const userName = req.body.userName;
    res.render("code", { roomNo, userName });
});


// Handle socket connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  let id=socket.id;

  // Send welcome message
  socket.emit("Connected_Successful", id);

  // Listen for messages from the client
  socket.on("createNew",()=>{
    let RoomNO = createRoom();
    console.log(RoomNO);
    socket.emit('roomNo',RoomNO );
  })

socket.on("Check", (RoomNo) => {
  if (rooms.has(RoomNo)) {
    const usersInRoom = rooms.get(RoomNo);

    if (usersInRoom.size >= 30) {
      // Room already full
      socket.emit("RoomCheck", "full");
    } else {
      // Room exists and has space
      socket.emit("RoomCheck", "yes");
    }
  } else {
    // Room doesn't exist
    socket.emit("RoomCheck", "No");
  }
});
socket.on("joinRoom", ({ roomNo, userName }) => {
  if (!rooms.has(roomNo)) {
    console.log(`❌ Room ${roomNo} not found. Cannot join.`);
    socket.emit("RoomError", "Room not found or expired.");
    return;
  }

  const usersInRoom = rooms.get(roomNo);

  if (usersInRoom.size >= 30) {
    console.log(`⚠️ Room ${roomNo} is full.`);
    socket.emit("RoomError", "Room is already full.");
    return;
  }

  usersInRoom.set(socket.id, userName);
  socket.join(roomNo);

  console.log(`${userName} joined room ${roomNo}`);

  const userList = Array.from(usersInRoom, ([id, username]) => ({ id, username }));
  io.to(roomNo).emit("userList", userList);
});

socket.on("sendCode", ({ roomNo, userName, code }) => {
  // Broadcast to all others in the room with username
  socket.to(roomNo).emit("receiveCode", {
    userName,
    code
  });
});
  socket.on("output", ({ roomNo, output }) => {
    // Emit to everyone in the room
    io.to(roomNo).emit("receiveOutput", { output });
  });




socket.on("disconnect", () => {
  console.log("Client disconnected:", socket.id);

  // Iterate through all rooms
  rooms.forEach((usersMap, roomNo) => {
    if (usersMap.has(socket.id)) {
      usersMap.delete(socket.id);

      if (usersMap.size === 0) {
        // No users left, delete the whole room
        rooms.delete(roomNo);
        console.log(`Room ${roomNo} deleted because it's empty.`);
      } else {
        // Still users left, update their list
        const updatedUsers = Array.from(usersMap, ([id, username]) => ({ id, username }));
        io.to(roomNo).emit("userList", updatedUsers);
      }
    }
  });
});


});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
