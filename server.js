const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// mongo stuff
let Schema = mongoose.Schema;

let userSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  count: Number,
  log: [Object]
});

let User = mongoose.model('User', userSchema);

// Not found middleware
//app.use((req, res, next) => {
//  return next({status: 404, message: 'not found'})
//});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

// checking date
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
};

// API endpoint
app.post("/api/exercise/new-user", function(request, response) {
  User.findOne({ username: request.body.username }, function (err, data) {
    if (err) {
      return err;
    };
    if (data == null) {
      User.create({ username: request.body.username, count: 0 }, function(err, newUser){
        if (err) {
          return err;
        };
        response.json({ "_id": newUser['id'], "username": newUser['username'] });
      });

    } else {
      response.send('<p>Username already taken.</p>');
    }
  });
});

// adding new exercises
app.post("/api/exercise/add", function(request, response) {
  User.find({ _id: request.body.userId }, function(err, data) {
    if (err) {
      return err;
    };
    if (data.length === 0) {
      response.send('<p>Unknown _id.</p>');
    } else if (!request.body.duration) {
      response.send('<p>Path `duration` is required.</p>');
    } else if (!request.body.description) {
      response.send('<p>Path `description` is required.</p>');
    } else {
      User.findByIdAndUpdate(data[0]['_id'], { $set: { count: data[0]['count'] + 1, log: [...data[0]['log'], { description: request.body.description, duration: request.body.duration, date: request.body.date || new Date().toISOString().slice(0, 10)}] }}, function(err, updatedUser) {
        if (err) {
          return err;
        };
          response.json({ "_id": updatedUser._id,
                  "username": updatedUser.username,
                  "description": request.body.description,
                  "duration": request.body.duration,
                  "date": request.body.date || new Date().toISOString().slice(0, 10) });
      });
    };
  });
});

// getting user info
app.get("/api/exercise/log", function(request, response) {
  User.findById(request.query.userId, function(err, user) {
    if (err) {
      response.send('Unknown userId.')
      return err;
    };
    let results = user.log;
    let fromDate = new Date(request.query.from);
    let toDate = new Date(request.query.to);
    let limit = Number(request.query.limit);
    let limitCount;
    // check if to is defined
    if (isValidDate(toDate)){
      results = results.filter((item) => (item.date >= fromDate.toISOString().slice(0, 10) && item.date <= toDate.toISOString().slice(0, 10)));
    // check if from is defined
    } else if (isValidDate(fromDate)) {
      results = results.filter((item)=>(item.date >= fromDate.toISOString().slice(0, 10)));
    }
    // check if there's a valid limit
    if (!isNaN(limit) && results.length > limit){
      results = results.slice(0, limit);
      limitCount = limit;
    }
    response.json({"id": user._id, "username": user.username, count: limitCount || user.count, log: results });
  });
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
