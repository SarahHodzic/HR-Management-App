var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const moment = require('moment');
const saltRounds = 10;

//hashing a password
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
    console.log(req.session);
    console.log(req.session.userId);
    const flashMessages = req.flash('error')[0];
    res.render('login', {title: 'Login', flashMessages});
});

router.post('/login_validation', async function (req, res, next) {
    const data = req.body;
    console.log(data.password);
    const hashedPassword = await getHashedPassword(data.password);
    console.log(hashedPassword);
    req.pool.connect((err, client, done) => {
        if (err)
            return res.send('Error while trying to connect to database ' + err);
        client.query(`select * from opkn.users where email = $1`, [data.email], async (err, result) => {
            done();
            if (err)
                return res.send('Login error' + err);

            if (result.rows.length < 1) {
                req.flash('error', 'Password and/or email incorrect. Please try again');
                return res.redirect('/login');
            }


            console.log(result.rows);
            const user = {
                id: result.rows[0].id,
                role: result.rows[0].role_id,
                name: result.rows[0].name,
                surname: result.rows[0].surname,
                email: result.rows[0].email
            }

            console.log(user);
            console.log(result.rows[0]);
            bcrypt.compare(data.password, result.rows[0].password, function (err, results) {
                if (err) {
                    console.error('Error while comparing passwords:', err);
                    return res.send(err);
                }
                req.session.userId = user.id;
                req.session.userRole = user.role;
                req.session.name = user.name;
                req.session.surname = user.surname;
                req.session.email = user.email;
                console.log(req.session.name);
                if (results) {
                    res.redirect('/')
                } else {
                    req.flash('error', 'Password and/or email incorrect. Please try again');
                    return res.redirect('/login');
                }
            });
        })
    })

});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;
