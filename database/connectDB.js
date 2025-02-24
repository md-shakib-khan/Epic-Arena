import mongoose from 'mongoose';


const connection = {};

export const connectDB = async () => {
  const uri =
    process.env.NODE_ENV === "development"
      ? process.env.MONGO_DB_URI_DEV
      : process.env.MONGO_DB_URI_PRO;

  // Check if the database URI is provided
  if (!uri) {
    console.error("MongoDB URI not found in environment variables!");
    process.exit(1);
  }

  if (connection.isConnected) {
    console.log("Already connected to the database");
    return;
  }

  try {
    const instance = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    // Use instance.connection.readyState for clarity
    connection.isConnected = instance.connection.readyState;

    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);

    // Graceful exit in case of a connection error
    process.exit(1);
  }
};


