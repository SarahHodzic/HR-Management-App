var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/application_documents')); // Apsolutna putanja
    },
    filename: function (req, file, cb) {
        cb(null, `${req.params.userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({storage: storage});

/* GET form page. */
router.get('/:id', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const jobId = req.params.id;
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("SELECT * FROM opkn.users WHERE id = $1", [req.session.userId], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data " + err})
            await client.query("SELECT * FROM opkn.job_fields WHERE job_id = $1", [jobId], async (err1, result1) => {
                if (err1)
                    return res.status(500).json({error: "Error while trying to fetch data (job fields) " + err1})
                await client.query("SELECT * FROM opkn.jobs WHERE id = $1", [jobId], async (err2, result2) => {
                    if (err2)
                        return res.status(500).json({error: "Error while trying to fetch data (job) " + err2})

                    const job_fields = result1.rows;
                    const user_info = result.rows[0];
                    const job = result2.rows[0];

                    console.log("JOB FIELDS ", job_fields);

                    res.render('apply_job', {
                        title: 'HRWorks',
                        user: user,
                        user_info: user_info,
                        job_fields: job_fields,
                        job: job

                    });
                });
            });
        });
    });
});

/* Submit application */
router.post("/submit_application/:userId/:jobId", upload.any(), async function (req, res, next) {
    try {
        const userId = req.params.userId;
        const jobId = req.params.jobId;
        const formData = req.body;

        if (req.files && req.files.length > 0) {
            formData.files = req.files.map(file => ({
                fieldName: file.fieldname,
                filePath: `/application_documents/${file.filename}`,
                originalName: file.originalname
            }));
        }

        await req.pool.query(
            'INSERT INTO opkn.applications (user_id, job_id, form_data) VALUES ($1, $2, $3)',
            [userId, jobId, formData]
        );

        res.render("apply_job_success", {title: "HRWorks"})
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing form');
    }
});


module.exports = router;
