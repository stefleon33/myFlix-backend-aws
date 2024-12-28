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

if (!process.env.CONNECTION_URI) {
    console.error("Error: CONNECTION_URI is not set in the .env file");
} else {
    mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB successfully!'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));
}


const express = require('express'),
  app = express(),
  bodyParser = require('body-parser'),
  uuid = require('uuid');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');
app.use(cors());

let auth = require('./auth')(app);

const passport = require('passport');
require('./passport');

const { check, validationResult } = require('express-validator');

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
 * @function addFavroiteMovie
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
 * @function deleteFavroiteMovie
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

/**
 * Starts the Express server to listen for incoming requests.
 * @param {number} port - The port number to run the server on.
 * @returns {void} Logs a message indicating the server is running.
 */
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0',() => {
 console.log('Listening on Port ' + port);
});