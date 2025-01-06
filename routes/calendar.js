var express = require('express');
var router = express.Router();
require('dotenv').config();
const nodemailer = require("nodemailer");
const {google} = require("googleapis");
const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    const oauth2Client = new OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.REFRESH_TOKEN
    });

    const accessToken = await new Promise((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
            if (err) {
                reject("Failed to create access token :(");
            }
            resolve(token);
        });
    });

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: process.env.EMAIL,
            accessToken,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            refreshToken: process.env.REFRESH_TOKEN
        }
    });

    return transporter;
};


/* GET home page. */
router.get('/:id', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const adminId = req.params.id;

    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query(`SELECT * FROM opkn.calendar WHERE user_id = $1`, [adminId], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while fetching data (calendar events)" + err})
            await client.query(`SELECT * FROM opkn.jobs WHERE admin_id = $1`, [adminId], async (err1, result1) => {
                if (err1)
                    return res.status(500).json({error: "Error while fetching data (jobs)" + err1})

                const events = result.rows.map(event => {
                    return {
                        ...event,
                        description: event.title
                    };
                });

                const jobs = result1.rows;
                console.log("EVENTS ", events);
                console.log("JOBS", jobs);
                res.render('calendar', {
                    title: 'Calendar | HRWorks',
                    user: user,
                    events: JSON.stringify(events),
                    jobs: jobs
                })
            });
        });
    });
});

router.post("/add-event/:id", async function (req, res, next) {
    const adminId = req.params.id;
    const {title, start, end, user_email, jobId} = req.body;
    console.log("ADMIN ID", adminId);
    console.log("DATA", req.body);

    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("INSERT INTO opkn.calendar(user_id, title,start,\"end\") VALUES($1,$2,$3,$4)", [adminId, title, start, end], async (err, result) => {
            done();
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({error: "Error while inserting calendar event" + err})
            }
            await client.query("SELECT title FROM opkn.jobs WHERE id = $1", [jobId], async (err1, result1) => {
                if (err1) {
                    console.error("Database error:", err1);
                    return res.status(500).json({error: "Error while gettting job information" + err1})
                }
                console.log("JOB TITLE ", result1.rows);
                let job_title;
                if (result1.rows.length !== 0) {
                    job_title = result1.rows[0].title;
                }
                console.log("JOB TITLE ", job_title);
                const mailOptions = {
                    from: {
                        name: 'HRM',
                        address: process.env.EMAIL
                    }, // sender address
                    to: user_email, // list of receivers
                    subject: `Interview appointment date for job posting: ${job_title}`, // Subject line text: "Hello world?", // plain text body
                    text: `Hi, your interview is scheduled on ${start}. Looking forward to speaking with you!`, // html body attachments
                    replyTo: req.session.email
                }
                if (user_email && job_title) {
                    let emailTransporter = await createTransporter();
                    await emailTransporter.sendMail(mailOptions);
                    console.log("Email has been sent!");
                }
                res.status(200).json({success: true});
            })
        });
    });
});

// Delete event route
router.delete("/delete-event/:eventId", async function (req, res, next) {
    const eventId = req.params.eventId;
    console.log("Event ID to delete:", eventId);

    await req.pool.connect(async (error, client, done) => {
        if (error) {
            return res.status(500).json({error: "Error while connecting to the database: " + error});
        }
        await client.query("DELETE FROM opkn.calendar WHERE id = $1", [eventId], async (err, result) => {
            done();
            if (err) {
                console.error("Error while deleting event:", err);
                return res.status(500).json({error: "Error while deleting event" + err.message});
            }
            res.status(200).json({success: true});
        });
    });
});

router.get("/get-users/:jobId", async function (req, res, next) {
    const jobId = req.params.jobId;
    await req.pool.connect(async (error, client, done) => {
        if (error) {
            return res.status(500).json({error: "Error while connecting to the database: " + error});
        }
        await client.query(`SELECT u.id, u.name, u.surname, u.email
                            FROM opkn.applications a 
                            LEFT JOIN opkn.users u ON u.id = a.user_id
                            WHERE a.job_id = $1`, [jobId], async (err, result) => {
            done();
            if (err) {
                console.error(err);
                return res.status(500).json({error: "Error while getting data (users)" + err.message});
            }
            const users = result.rows;
            res.status(200).json({success: true, users: users});
        });
    });
})


module.exports = router;
