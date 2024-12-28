# MyFlix API

A movie API system providing movie and user management with features like authentication and data validation.

## Features

- **Movies API**: Access movie details.
- **User Management**: Manage users and their favorite movies.
- **Authentication**: JWT-based security.
- **Swagger Documentation**: Interactive API docs.
- **Data Validation**: Ensures data integrity.

## Technologies

- **Express.js**: Node.js web framework.
- **MongoDB**: NoSQL database.
- **Mongoose**: MongoDB ODM.
- **Passport.js**: Authentication middleware.
- **Swagger**: API documentation tool.
- **Cors**: Cross-Origin Resource Sharing middleware.
- **Bcrypt**: Password hashing.

## API Endpoints

Movies

- Get all movies: GET /movies
- Get a movie by title: GET /movies/:Title
- Get movies by genre: GET /movies/Genre/:genreName
- Get a director by name: GET /movies/director/:directorName

Users

- Get all users: GET /users
- Create a user: POST /users
- Update a user: PUT /users/:Username
- Delete a user: DELETE /users/:Username
- Add movie to favorites: POST /users/:Username/movies/:MovieID
- Remove movie from favorites: DELETE /users/:Username/movies/:MovieID
