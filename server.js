import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import MongoStore from "connect-mongo";
import jwt from "jsonwebtoken";
import path from "path";
import { Server } from "socket.io";
import { connectDB } from "./database/connectDB.js";
import { User } from "./database/userModel.js";
import { verifyAuth, verifyUser } from "./middleware/verifyUser.js";

// Use import.meta.url to get the directory path in ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const app = express();
const port = process.env.PORT || 7000;

const middleware = [
  express.json(),
  express.urlencoded({ extended: true }),
  cors(),
  cookieParser(),
  (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    return res.status(statusCode).json({
      success: false,
      message,
    });
  },
  express.static(path.join(__dirname, "public")),
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl:
        process.env.NODE_ENV === "development"
          ? process.env.MONGO_DB_URI_DEV
          : process.env.MONGO_DB_URI_PRO, // Your MongoDB connection URL
      collectionName: "sessions",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
  passport.initialize(),
  passport.session(),
];
app.use(middleware);

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    if (!req.user) {
      return res.redirect("/login"); // Redirect if no user data is found
    }

    const payload = {
      id: req.user.id,
      name: req.user.displayName,
      email: req.user.emails ? req.user.emails[0].value : req.user.email,
      avatar: req.user.photos ? req.user.photos[0].value : req.user.photo,
    };

    try {
      // Check if user exists in the database
      let user = await User.findOne({ email: req.user.emails[0].value });

      // If user does not exist, create a new one
      if (!user) {
        user = new User({
          name: req.user.displayName,
          email: req.user.emails[0].value,
          avatar: req.user.photos[0].value,
        });

        await user.save(); // Save the user in the database
      }

      // Generate a JWT token with a 1-hour expiration
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      // Set the token as a cookie with httpOnly and secure flags
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Can be simplified like this
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      res.redirect("/");
    } catch (err) {
      console.error("Error generating JWT:", err);
      res.redirect("/"); // Or handle the error more gracefully
    }
  }
);

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login"); // Redirect to the homepage after logging out
});

// Set EJS as the view engine
app.set("view engine", "ejs");

// Route for rendering an EJS view (example)
app.get("/", verifyUser, (req, res) => {
  const games = [
    {
      name: "Tic Tac Toe",
      image:
        "https://plus.unsplash.com/premium_photo-1689245691969-995fea0c4061?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8dGljJTIwdGFjJTIwdG9lfGVufDB8fDB8fHww",
      players: 120,
      href: "tic-tac-toe",
    },
    { name: "Game 2", image: "https://picsum.photos/200/300", players: 45 },
    { name: "Game 3", image: "https://picsum.photos/200/300", players: 70 },
    // More games...
  ];
  const data = {
    title: "Home Page",
    message: "Welcome to Epic Arena!",
    games: games,
  };
  res.status(200).render("index", data); // "home.ejs" will be rendered
});

// Profile route
app.get("/profile", verifyUser, (req, res) => {
  // Render the profile page and pass the user data
  const user = {
    name: req.user.name,
    email: req.user.email,
    avatar: req.user.avatar,
  };

  res.render("profile", { user: user });
});

app.get("/tic-tac-toe", (req, res) => {
  res.status(200).render("tictactoe", { title: "Tic Tac Toe" });
});

app.get("/login", verifyAuth, (req, res) => {
  res.status(200).render("login", { title: "Login Page" });
});

// Create HTTP server
const server = app.listen(port, async () => {
  await connectDB();
  console.log(`Server running on http://localhost:${port}`);
});

// Initialize socket.io
const io = new Server(server);

let rooms = {};

// Socket.io connectionio.on('connection', (socket) => {
io.on("connection", (socket) => {
  console.log("A user connected - " + socket.id);

  socket.on("JoinRoom", (room, callback) => {
    // Check if the room exists in the rooms object
    const roomDetails = rooms[room];

    if (roomDetails) {
      // Check if there are already 2 users in the room
      if (roomDetails.users.length >= 2) {
        // If there are already 2 players, return success: false
        return callback({
          success: false,
          message: "Room is full. Only 2 players allowed.",
        });
      } else {
        // If there are less than 2 players, add the new user
        roomDetails.users.push(socket.id);
        io.to(room).emit("userJoined", socket.id);
        callback({ success: true });
      }
    } else {
      // If the room doesn't exist, create it with the new user
      rooms[room] = { room: room, users: [socket.id] };
      callback({ success: true });
    }

    // Add the socket to the room
    socket.join(room);

    // Log the rooms to the console for debugging
    console.log(rooms);
  });
  // Handle player move
  socket.on("makeMove", (data) => {
    const { room, index, player } = data;

    // Broadcast the move to other players in the room
    socket.to(room).emit("moveMade", { index, player });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected - " + socket.id);

    // Iterate through all rooms and find the room the user was in
    for (const room in rooms) {
      const roomDetails = rooms[room];

      // If the user was in the room, remove them
      if (roomDetails.users.includes(socket.id)) {
        roomDetails.users = roomDetails.users.filter((id) => id !== socket.id);

        // Emit a message to the room that the user has left
        io.to(room).emit("userLeft", socket.id);

        // If the room has no users left, remove the room from the rooms object
        if (roomDetails.users.length === 0) {
          delete rooms[room];
        }

        console.log(`User ${socket.id} disconnected from room ${room}`);
        break; // Exit the loop once the user is removed
      }
    }

    // Log the rooms after disconnection
    console.log(rooms);
  });
});
