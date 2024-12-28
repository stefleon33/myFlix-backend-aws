/**
 * @module models
 * @description This module defines the data models used in the application, including `Movie` and `User`.
 * It also includes methods for hashing and validating user passwords.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * @schema Movie
 * @description Mongoose schema for a Movie. Contains fields such as title, description, genre, director, and more.
 * @property {string} Title - The title of the movie.
 * @property {string} Description - A description of the movie plot.
 * @property {Genre} Genre - An object containing genre information.
 * @property {Director} Director - An object containing director information.
 * @property {string[]} Actors - An array of actor names who starred in the movie.
 * @property {string} ImagePath - The URL path to an image representing the movie (e.g., a poster).
 * @property {boolean} Featured - A boolean indicating whether the movie is featured.
 */ 

/**
 * @typedef {Object} Genre
 * @description Represents a movie genre.
 * @property {string} Name - The name of the genre (e.g., Action, Comedy, etc.).
 * @property {string} Description - A brief description of the genre.
 */

/**
 * @typedef {Object} Director
 * @description Represents a movie director.
 * @property {string} Name - The name of the director.
 * @property {string} Bio - A brief biography of the director.
 */
let movieSchema = mongoose.Schema({
    Title: {type: String, required: true},
    Description: {type: String, required: true},
    Genre:  {
        Name: String,
        Description: String
    },
    Director: {
        Name: String,
        Bio: String
    },
    Actors : [String],
    ImagePath: String,
    Featured: Boolean
});

/**
 * @schema User
 * @description Mongoose schema for a User. Contains fields such as username, password, email, birthday, and favorite movies.
 * @property {string} Username - The unique username for the user (must be alphanumeric).
 * @property {string} Password - The user's hashed password.
 * @property {string} Email - The user's email address.
 * @property {Date} Birthday - The user's date of birth.
 * @property {ObjectId[]} FavoriteMovies - An array of movie IDs (ObjectIds) that the user has marked as favorites.
 */

/**
 * @typedef {Object} User
 * @description Represents a user in the application.
 * @property {string} Username - The username of the user (alphanumeric).
 * @property {string} Password - The hashed password of the user.
 * @property {string} Email - The email address of the user.
 * @property {Date} Birthday - The user's birthdate.
 * @property {ObjectId[]} FavoriteMovies - A list of movie IDs marked as favorites by the user.
 */
let userSchema = mongoose.Schema({
    Username: {type: String, required: true},
    Password: {type: String, required: true},
    Email: {type: String, required: true},
    Birthday: Date,
    FavoriteMovies: [{ type: mongoose.Schema.Types.ObjectId, ref:'Movie'}]
});

/**
 * @function hashPassword
 * @description Static method to hash a password before storing it in the database.
 * @param {string} password - The plain text password to be hashed.
 * @returns {string} The hashed password.
 */
userSchema.statics.hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

/**
 * @function validatePassword
 * @description Instance method to validate the user's password against the hashed password stored in the database.
 * @param {string} password - The plain text password to validate.
 * @returns {boolean} `true` if the password is correct, otherwise `false`.
 */
userSchema.methods.validatePassword = function(password) {
    return bcrypt.compareSync(password, this.Password);
};

/**
 * @function Movie
 * @description The Mongoose model for the `Movie` schema.
 * @returns {mongoose.Model} The Movie model used for interacting with the movies collection.
 */
let Movie = mongoose.model('Movie', movieSchema);

/**
 * @function User
 * @description The Mongoose model for the `User` schema.
 * @returns {mongoose.Model} The User model used for interacting with the users collection.
 */
let User = mongoose.model('User', userSchema);

// Export the Movie and User models
module.exports.Movie = Movie;
module.exports.User = User;