var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const connectFlash = require('connect-flash');
const {Pool} = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const loginRouter = require('./routes/login');
const registerRouter = require('./routes/register');
const userProfileRouter = require('./routes/user_profile');
const contestRouter = require('./routes/contest');
const allJobPostingsRouter = require('./routes/all-job-postings');
const applyJobRouter = require('./routes/apply_job');
const applicationsRouter = require('./routes/applications');
const candidatesRouter = require('./routes/candidates');
const calendarRouter = require('./routes/calendar');
const chatRouter = require('./routes/chat');
const adminRouter = require('./routes/admin_panel');
const documentsRouter = require('./routes/documents');
const individualJobPostingRouter = require('./routes/individual_job_posting');


var app = express();

// Initialize Pool
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    max: 100,
    idleTimeoutMillis: 3000
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// Pass the pool to each route
app.use((req, res, next) => {
    req.pool = pool;
    next();
});

app.use(session({
    secret: 'This is my secret key',
    resave: false,
    saveUninitialized: false
}))
app.use(connectFlash());

// All users can access including not logged-in users
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/login', loginRouter);
app.use('/register', registerRouter);
app.use('/individual-job-posting', individualJobPostingRouter);

app.use((req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    next();
});

const checkAdmin = async (req, res, next) => {
    const userRole = req.session.userRole;
    if (userRole !== 1) {
        return res.redirect('/');
    }
    next();
};

const checkUser = async (req, res, next) => {
    const userRole = req.session.userRole;
    if (userRole !== 2) {
        return res.redirect('/');
    }
    next();
};
//Admins and logged-in users can access
app.use('/user_profile', userProfileRouter);
app.use('/chat', chatRouter);
//Only logged-in users that are not admins can access
app.use((req, res, next) => {
    if (!req.session.userId && req.session.userRole === 1) {
        return res.redirect('/');
    }
    next();
});

app.use('/applications', checkUser, applicationsRouter);
app.use('/contest', checkAdmin, contestRouter);
app.use('/all_job_postings', checkAdmin, allJobPostingsRouter);
app.use('/apply_job', checkUser, applyJobRouter);
app.use('/candidates', checkAdmin, candidatesRouter);
app.use('/calendar', checkAdmin, calendarRouter);
app.use('/admin_panel', checkAdmin, adminRouter);
app.use('/documents', checkAdmin, documentsRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
