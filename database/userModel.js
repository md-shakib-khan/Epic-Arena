import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Define User Schema
const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      match: [/\S+@\S+\.\S+/, "Please enter a valid email address"], // Basic email validation
    },
    avatar: {
      type: String,
      required: false, // Make image optional
    },
  },
  { timestamps: true }
);

// Create the User model using the schema
export const User = model("User", UserSchema);
