import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/mongoose";
import userRoutes from "./routes/userRoutes";
import groupRoutes from "./routes/groupRoutes";
import broadcastRoutes from "./routes/broadcastRoutes";
import chatRoutes from "./routes/chatRoutes";

const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server and integrate Socket.IO
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://192.168.1.47:3000",
            "https://chat-app-w4lf.onrender.com/",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    },
});

// Middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://192.168.1.47:3000",
            "https://chat-app-w4lf.onrender.com/",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/chats", chatRoutes(io));

// Connect to MongoDB
connectDB();

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Listen for sendMessage event
    socket.on("sendMessage", (message) => {
        console.log("New message received:", message);

        // Broadcast the message to the receiver
        socket.broadcast.emit("receiveMessage", message);
    });

    // Listen for a message deletion event from a client
    socket.on("messageDeleted", ({ messageId, senderId, receiverId }) => {
        console.log(
            `Message with ID ${messageId} deleted by ${senderId} or ${receiverId}`
        );

        // Broadcast the deletion event to all connected clients, or a specific room/user
        io.emit("messageDeleted", { messageId, senderId, receiverId }); // Adjust this to target specific users/rooms if needed
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// import express from "express";
// import cors from "cors";
// import { Server as SocketIOServer } from "socket.io";
// import http from "http"; // Required for socket.io
// import connectDB from "./config/mongoose";
// import userRoutes from "./routes/userRoutes";
// import groupRoutes from "./routes/groupRoutes";
// import broadcastRoutes from "./routes/broadcastRoutes";
// import chatRoutes from "./routes/chatRoutes";

// const app = express();
// const port = process.env.PORT || 5000;

// // Create a server with http and integrate it with socket.io
// const server = http.createServer(app);
// const io = new SocketIOServer(server, {
//     cors: {
//         origin: [
//             "http://localhost:5173",
//             "http://localhost:3000",
//             "http://192.168.1.47:3000",
//         ],
//         methods: ["GET", "POST", "PUT", "DELETE"],
//     },
// });

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use("/api/users", userRoutes);
// app.use("/api/groups", groupRoutes);
// app.use("/api/broadcast", broadcastRoutes);
// app.use("/api/chats", chatRoutes);

// // Connect to MongoDB
// connectDB();

// // Socket.IO connection handling
// io.on("connection", (socket) => {
//     console.log("A user connected");

//     // Join rooms for specific users
//     socket.on("joinRoom", (roomId) => {
//         socket.join(roomId); // Join the specific room
//         console.log(`User joined room: ${roomId}`);
//     });

//     // Listening for a new message event
//     socket.on("sendMessage", (messageData) => {
//         const receiverRoom = messageData.receiver.userId; // Assuming receiver userId is the room ID
//         console.log(`Sending message to room: ${receiverRoom}`);

//         // Emit the message to the receiver's room
//         io.to(receiverRoom).emit("receiveMessage", messageData);
//     });

//     socket.on("disconnect", () => {
//         console.log("A user disconnected");
//     });
// });

// // Start the server
// server.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
