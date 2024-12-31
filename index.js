/**
 * @module index
 * @description This module is the entry point for the application and handles all the routes for the API.
 * It connects to MongoDB and defines various routes for user and movie management.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Models = require('./models.js');

const Movies = Models.Movie;
const Users = Models.User;

console.log("Mongo URI from .env file:", process.env.CONNECTION_URI); // Log the value of CONNECTION_URI
console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY);

if (!process.env.CONNECTION_URI) {
    console.error("Error: CONNECTION_URI is not set in the .env file");
} else {
    mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB successfully!'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));
}


const express = require('express'),
  app = express(),
  bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');
app.use(cors());

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

let auth = require('./auth')(app);

const passport = require('passport');
require('./passport');

const { check, validationResult } = require('express-validator');

const { 
  S3Client, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  GetObjectCommand 
} = require('@aws-sdk/client-s3');

const fs = require('fs');
const fileUpload = require('express-fileupload');
const path = require('path');

const AWS = require('aws-sdk');

// AWS S3 client configuration
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, 
});

// Bucket name 
const BUCKET_NAME = process.env.BUCKET_NAME || 'myflix-frontend-aws'; 

// Middleware for handling file uploads
app.use(fileUpload());

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const { S3 } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { Readable } = require("stream");

const s3 = new S3();

// Helper function to convert a stream to a buffer
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", (err) => reject(err));
    });
};

app.get('/', (req, res) => {
  res.status(200).send('Welcome to the Node.js application!');
});

/**
 * @namespace UserRoutes
 * @description Routes related to user management.
 */

/**jsdoc
 * @function registerUser
 * @memberof UserRoutes
 * @description Allows new users to register by providing a username, password, email, and birthday.
 * @param {Object} req - The request object containing the user data (Username, Password, Email, Birthday).
 * @param {Object} res - The response object to send back the status or error message.
 * @returns {Object} JSON response with the user data or error message.
 */

app.post('/users',
  [
    check('Username', 'Username is required').isLength({min: 5}),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid').isEmail()
  ],async (req, res) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    let hashedPassword = Users.hashPassword(req.body.Password);
    await Users.findOne({ Username: req.body.Username}) // Search to see if a user with the requested username already exists
    .then((user) => {
      if (user) {
        return res.status(400).send(req.body.Username + 'already exists');
      } else {
        Users
          .create({
            Username: req.body.Username,
            Password: hashedPassword,
            Email: req.body.Email,
            Birthday: req.body.Birthday
          })
          .then((user) => {res.status(201).json(user) })
        .catch((error) => {
          console.error(error);
          res.status(500).send('Error: ' + error);
        })
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Error: ' + error);
    });
  });

/**
 * @function getUsers
 * @memberof UserRoutes
 * @description Returns a list of all registered users.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object containing the list of users.
 * @returns {Array} JSON array of all users.
 */
app.get('/users', passport.authenticate('jwt', { session: false }), async (req, res) => {
  await Users.find()
    .then((users) => {
      res.status(201).json(users);
    })
    .catch((err) => {
      console.error(err);
      res.status (500).send('Error: ' + err);
    });
});

/**
 * @function getSingleUser
 * @memberof UserRoutes
 * @description Returns a single registered user's information. 
 * @param {Object} req - The request object containing the username in the URL parameter.
 * @param {Object} res - The response object containing the user data.
 * @returns {Object} JSON object with user data.
 */
app.get('/users/:Username', passport.authenticate('jwt', { session: false }),
[
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric()
], async (req, res) => {
  await Users.findOne({ Username: req.params.Username })
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});  

/**
 * @function UpdateUser
 * @memberof UserRoutes
 * @description Allows a user to  update their information. 
 * @param {Object} req - The request object containing updated user data.
 * @param {Object} res - The response object containing the updated user data.
 * @returns {Object} JSON object with the updated user data.
 */
app.put('/users/:Username', passport.authenticate('jwt', { session: false }), 
  [
    check('Username', 'Username is required').isLength({min: 5}),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid').isEmail()
  ], async (req, res) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    if(req.user.Username !== req.params.Username){
      return res.status(400).send('Permission denied');
    }
    await Users.findOneAndUpdate({ Username: req.params.Username }, { $set:
      {
        Username: req.body.Username,
        Password: req.body.Password,
        Email: req.body.Email,
        Birthday: req.body.Birthday
      }
    },
    { new: true }) // This line makes sure that the updated document is returned
    .then((updatedUser) => {
      res.json(updatedUser);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    })
  });

/**
 * @function addFavoriteMovie
 * @memberof UserRoutes
 * @description Allows users to add a movie to their list of favorite movies.
 * @param {Object} req - The request object containing the username and movie ID in the URL parameters.
 * @param {Object} res - The response object confirming that the movie has been added.
 * @returns {Object} JSON object with updated user data.
 */
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }),
[
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('MovieID', 'MovieID is required').not().isEmpty()
], async (req, res) => {
  await Users.findOneAndUpdate({ Username: req.params.Username }, {
     $push: { FavoriteMovies: req.params.MovieID }
   },
   { new: true }) // This line makes sure that the updated document is returned
  .then((updatedUser) => {
    res.json(updatedUser);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  });
});

/**
 * @function deleteFavoriteMovie
 * @memberof UserRoutes
 * @description Allows users to remove a movie from their list of favorite movies.
 * @param {Object} req - The request object containing the username and movie ID in the URL parameters.
 * @param {Object} res - The response object confirming that the movie has been removed.
 * @returns {Object} JSON object with updated user data.
 */
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), 
[
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('MovieID', 'MovieID is required').not().isEmpty()
], async (req, res) => {
  await Users.findOneAndUpdate({ Username: req.params.Username }, {
     $pull: { FavoriteMovies : req.params.MovieID }
   },
   { new: true }) // This line makes sure that the updated document is returned
  .then((updatedUser) => {
    res.json(updatedUser);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err); 
  });
});


/**
 * @function deleteUser
 * @memberof UserRoutes
 * @description Allows existing users to deregister by deleting their account.
 * @param {Object} req - The request object containing the username in the URL parameter.
 * @param {Object} res - The response object confirming the user has been deleted.
 * @returns {Object} Confirmation message or error.
 */
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }),
[
  check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric()
], async (req, res) => {
  await Users.findOneAndDelete({ Username: req.params.Username })
    .then((user) => {
      if (!user) {
        res.status(400).send(req.params.Username + ' was not found');
      } else {
        res.status(200).send(req.params.Username + ' was deleted.');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});

/** 
 * @namespace MovieRoutes
 * @description Routes related to movie management.
 */

/**
 * @function getMovies
 * @memberof MovieRoutes
 * @description Returns a list of all movies available in the database.
 * @param {Object} req - The request object containing authentication details.
 * @param {Object} res - The response object containing the list of movies.
 * @returns {Array} JSON array of all movies.
 */
app.get('/movies', passport.authenticate('jwt', { session: false }), async (req, res) => {
  await Movies.find()
    .then((movies) => {
      res.json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});  

/**
 * @function getMovieDetails
 * @memberof MovieRoutes
 * @description Returns detailed information about a single movie by its title.
 * @param {Object} req - The request object containing the movie title in the URL parameter.
 * @param {Object} res - The response object containing the movie data.
 * @returns {Object} JSON object with movie details.
 */
app.get('/movies/:Title', passport.authenticate('jwt', { session: false }), async (req, res) => {
  await Movies.findOne({ Title: req.params.Title })
  .then((movies) => {
    res.json(movies);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  });
});  

/**
 * @function getGenreDetails
 * @memberof MovieRoutes
 * @description Returns detailed information about movies of a specific genre by name/title.
 * @param {Object} req - The request object containing the genre name in the URL parameter.
 * @param {Object} res - The response object containing movies of that genre.
 * @returns {Array} JSON array of movies in the specified genre.
 */
app.get('/movies/Genre/:genreName', passport.authenticate('jwt', { session: false }), async (req, res) => {
  await Movies.findOne({ "Genre.Name": req.params. genreName})
  .then((movies) => {
    res.json(movies);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  });
});  

/**
 * @function getDirectorDetails
 * @memberof MovieRoutes
 * @description Returns detailed information about movies directed by a specific director, including bio, birth year, and death year.
 * @param {Object} req - The request object containing the director's name in the URL parameter.
 * @param {Object} res - The response object containing movies by the specified director.
 * @returns {Array} JSON array of movies directed by the specified director.
 */
app.get('/movies/director/:directorName', passport.authenticate('jwt', { session: false }), async (req, res) => {
  await Movies.findOne({ "Director.Name": req.params. directorName})
  .then((movies) => {
    res.json(movies);
  })
  .catch((err) => {
    console.error(err);
    res.status(500).send('Error: ' + err);
  });
});

// Endpoint to list all objects in the S3 bucket
app.get('/list-objects', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
    const listObjectsParams = {
        Bucket: BUCKET_NAME,
        Prefix: 'original-images/',
    };

    s3Client.send(new ListObjectsV2Command(listObjectsParams)).then(
        (listObjectsResponse) => {
            // Send only the contents of the uploads folder
            res.send(listObjectsResponse);
        })
        .catch((err) => {
            res.status(500).send('Error listing objects: ' + err.message);
        });
});

// Endpoint to upload an object to the S3 bucket
app.post('/upload', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
    if (!req.files || !req.files.image) {
        return res.status(400).send('No file uploaded');
    }

    const file = req.files.image;
    const fileName = encodeURIComponent(file.name);

    // Validate image type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.mimetype)) {
        return res.status(400).send('Invalid file type');
    }

    const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: `original-images/${fileName}`,
        Body: file.data,
        ContentType: file.mimetype,
    };

    s3Client.send(new PutObjectCommand(uploadParams))
        .then(() => res.json({ message: 'File uploaded successfully!' }))
        .catch((error) => {
            console.error('Upload error:', error);
            res.status(500).send('Error uploading file');
        });
});

// Endpoint to retrieve an object from the S3 bucket
app.get('/download/:filename', async (req, res) => {
    const { filename } = req.params;
    console.log('Requested filename:', filename);
    
    const downloadParams = {
        Bucket: BUCKET_NAME,
        Key: `original-images/${filename}`
    };

    try {
        const data = await s3Client.send(new GetObjectCommand(downloadParams));

        // Set the headers for file download
        res.setHeader('Content-Type', data.ContentType); // Set the content type of the file
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`); // Force download

        // Stream the object to the response
        data.Body.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        if (error.name === 'NoSuchKey') {
            res.status(404).send('File not found');
        } else {
            res.status(500).send('Error downloading the file');
        }
    }
});

exports.handler = async (event) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    // Extract the object key from the event
    const key = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log(`Processing object: ${key}`);

    // Skip processing if the file is not in the "original-images/" folder
    if (!key.startsWith("original-images/")) {
        console.log("Skipping file as it is not in the 'original-images/' folder.");
        return { statusCode: 200, body: "File skipped" };
    }

    try {
        // Fetch the object from S3
        console.log("Fetching object from S3...");
        const { Body, ContentType } = await s3.getObject({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        console.log("Object fetched successfully.");

        // Convert the readable stream to a buffer
        console.log("Converting image data to buffer...");
        const inputBuffer = await streamToBuffer(Body);
        console.log("Image data converted to buffer.");

        // Resize the image using Sharp
        console.log("Resizing image...");
        const resizedImage = await sharp(inputBuffer)
            .resize(300, 300, { fit: "inside", withoutEnlargement: true })
            .toBuffer();
        console.log("Image resized successfully.");

        // Generate the output key
        const outputKey = `resized-images/${key.split("/").pop()}`;
        console.log(`Uploading resized image to: ${outputKey}`);

        // Upload the resized image back to S3
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: outputKey,
            Body: resizedImage,
            ContentType: ContentType,
        });
        console.log(`Resized image uploaded successfully to ${outputKey}.`);

        // Return success response
        return {
            statusCode: 200,
            body: `Successfully resized and uploaded ${key} to ${outputKey}`,
        };
    } catch (error) {
        console.error("Error processing image:", error);
        return {
            statusCode: 500,
            body: `Error resizing image: ${error.message}`,
        };
    }
};

/**
 * Starts the Express server to listen for incoming requests.
 * @param {number} port - The port number to run the server on.
 * @returns {void} Logs a message indicating the server is running.
 */
const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0',() => {
 console.log('Listening on Port ' + port);
});