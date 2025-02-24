// Middleware to verify user token

import jwt from "jsonwebtoken";

export const verifyUser = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/login"); // Redirect to login if no token
    }

    // Verify the token (Replace 'your_secret_key' with your actual secret)
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.redirect("/login"); // Redirect to login if the token is invalid
      }

      // Attach the decoded user data to the request object for access in the route handler
      req.user = decoded;

      // Proceed to the next middleware/route handler
      next();
    });
  } catch (e) {
    // Catch any other errors and pass them to the error handler
    next(e);
  }
};

// Middleware to verify user authentication token
export const verifyAuth = (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies.token;

    if (!token) {
      // If no token is provided, go to the next middleware/route handler
      return next();
    }

    // Verify the token (Replace 'your_secret_key' with your actual secret)
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // If token verification fails, go to the next middleware/route handler
        return next();
      }

      // Attach the decoded user data to the request object for access in the route handler
      req.user = decoded;

      // Proceed to the next middleware/route handler
      next();
    });
  } catch (e) {
    // Catch any errors and pass them to the error handler
    next(e);
  }
};
