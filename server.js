const express = require("express");
const env = require("dotenv").config();
const adminRouter =  require("./router/admin.js"); 
const userRouter  = require("./router/user.js");
const {connectDatabase }= require("./db/connectDB.js");
const session = require("express-session");
const flash = require('connect-flash');
const passport = require("./config/passport.js");
const nocache = require("nocache");
const path = require("path");

const app = express();
const sessionMaxAgeHours = Number(process.env.SESSION_MAX_AGE_HOURS || 72);

app.set("trust proxy", 1);

if (!Number.isFinite(sessionMaxAgeHours) || sessionMaxAgeHours <= 0) {
  throw new Error("SESSION_MAX_AGE_HOURS must be a positive number");
}


app.use(express.static('public', {
    setHeaders: (res, path) => {
      if (path.endsWith('.css')) {
        res.set('Content-Type', 'text/css');
      } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.set('Content-Type', 'image/jpeg');
      }
    }
  }));
  

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionMaxAgeHours * 60 * 60 * 1000
    }
}));


// Passport middleware
app.use(passport.initialize());
app.use(passport.session());


app.use((req, res, next) => {
    if(req.session || req.session.adminId){
        res.setHeader('Cache-Control',' no-cache')
    }
    next();
})

// Set up flash
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.validationErrors = req.flash('validationErrors');
  next();
});


app.use(nocache());

app.use(express.json());
app.use(express.urlencoded({extended:true}));



app.use(express.static("public"))
app.set("view engine","ejs");
app.set('views', [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views')
]);



app.get("/admin", (req, res) => {
  res.redirect("/admin/login");
});

// Routers
app.use("/admin", adminRouter);
app.use("/", userRouter);
     

connectDatabase().then(()=>{
  app.listen(process.env.PORT, (err) => {
      console.log(`server is running at ${process.env.HOST}:${process.env.PORT}`);
  });

})
