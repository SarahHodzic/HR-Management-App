var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:id', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const applicationId = req.params.id;
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})

        client.query('SELECT form_data FROM opkn.applications WHERE id = $1', [applicationId], async (err, result) => {
            done();
            if (err) {
                return res.status(500).json({error: "Error while trying to get form_data", err});
            }
            const form_data = result.rows[0].form_data;
            console.log("FORM DATA", form_data);
            res.render('documents', {title: 'HRWorks', user: user, form_data: form_data});
        })
    });
});


module.exports = router;
