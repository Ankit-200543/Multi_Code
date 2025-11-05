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

function joinRoom(roomId, socketId, username) {
  if (!rooms.has(roomId)) {
    throw new Error("Room not found!");
  }
  const users = rooms.get(roomId);
  users.set(socketId, username);
  console.log(`${username} joined room ${roomId}`);
}

function deleteRoom(roomId) {
  if (rooms.has(roomId)) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  } else {
    console.log(`Room ${roomId} does not exist`);
  }
}
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

app.post("/code", (req, res) => {
    const roomNo = req.body.roomNo;
    const userName = req.body.userName;
    res.render("code", { roomNo, userName });
});
app.get("/createNew",(req,res)=>{
      let RoomNO = createRoom();
      res.send(RoomNO);

})
app.get("/check/:roomNO", (req, res) => {
  const roomNO = req.params.roomNO;
  if (rooms.has(roomNO)) {
    const usersInRoom = rooms.get(roomNO);

    if (usersInRoom.size >= 30) {
      res.send("full");
    } else {
      res.send("yes");
    }
  } else {
    res.send("No");
  }
});


// Handle socket connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  let id=socket.id;

  socket.emit("Connected_Successful", id);

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
  socket.to(roomNo).emit("receiveCode", {
    userName,
    code
  });
});
  socket.on("output", ({ roomNo, output }) => {
    io.to(roomNo).emit("receiveOutput", { output });
  });




socket.on("disconnect", () => {
  console.log("Client disconnected:", socket.id);

  rooms.forEach((usersMap, roomNo) => {
    if (usersMap.has(socket.id)) {
      usersMap.delete(socket.id);

      if (usersMap.size === 0) {
        rooms.delete(roomNo);
        console.log(`Room ${roomNo} deleted because it's empty.`);
      } else {
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
