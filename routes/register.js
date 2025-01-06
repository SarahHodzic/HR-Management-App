var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const moment = require('moment');
const saltRounds = 10;

const getHashedPassword = async (plainPassword) => {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(saltRounds, function (err, salt) {
            if (err)
                reject(err)
            bcrypt.hash(plainPassword, salt, function (err, hash) {
                if (err)
                    reject(err)
                else {
                    resolve(hash)
                }
            });
        });
    })
}

/* GET users listing. */
router.get('/', async function (req, res, next) {
    const flashMessages = req.flash('error')[0];
    res.render('register', {title: 'Register', flashMessages});
});


router.post('/insert', async function (req, res, done) {
    const {email, name, surname, password} = req.body;
    console.log("register form details " + req.body.name);
    console.log(email);
    const hashedPassword = await getHashedPassword(password);
    console.log("hashed password " + hashedPassword);
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: 'Error while trying to connect to database ' + error});
        await client.query('select email, name, surname from opkn.users where email = $1', [email], async (err, result) => {
            if (err) {
                done();
                return res.status(500).json({error: 'Error while fetching data ' + err})
            }
            console.log(result.rows.length);
            console.log(result.rows);
            if (result.rows.length > 0) {
                req.flash('error', 'That email is already in use. Please try again.')
                done();
                return res.redirect('/register')
            }
            await client.query('insert into opkn.users(email,name,surname,password,role_id) values($1, $2, $3, $4, 2)', [email, name, surname, hashedPassword], async (error, result) => {
                if (error) {
                    done();
                    return res.status(500).json({error: 'Error while inserting data ' + error})
                }
                res.redirect('/login')
            })
        })
    })
})


module.exports = router;
