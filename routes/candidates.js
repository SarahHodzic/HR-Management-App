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


router.post('/edit', async (req, res, next) => {
    const updatedData = {
        application_id: parseInt(req.body.application_id),
        comment: req.body.comment || '',
        experience: parseInt(req.body.experience) || 0,
        education: parseInt(req.body.education) || 0,
        technical_skills: parseInt(req.body.technical_skills) || 0,
        soft_skills: parseInt(req.body.soft_skills) || 0,
        motivation: parseInt(req.body.motivation) || 0,
        testing: parseInt(req.body.testing) || 0
    };

    console.log("UPDATED DATA", updatedData);
    console.log("APPLICATION ID", updatedData.application_id)
    console.log("ADMIN ID", req.session.userId)
    console.log("COMMENT", updatedData.comment)
    await req.pool.connect(async (error, client, done) => {
        if (error) {
            return res.status(500).json({error: "Error while trying to connect to database " + error});
        }
        console.log("okay proslo prvi krug")
        try {
            const reviewCheckResult = await client.query(
                `SELECT id FROM opkn.reviews WHERE application_id = $1`,
                [updatedData.application_id]
            );
            if (reviewCheckResult.rows.length === 0) {
                const insertReviewResult = await client.query(
                    `INSERT INTO opkn.reviews (application_id, admin_id,comment, experience, education, technical_skills, soft_skills, motivation, testing) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [updatedData.application_id, req.session.userId, updatedData.comment, updatedData.experience, updatedData.education, updatedData.technical_skills, updatedData.soft_skills, updatedData.motivation, updatedData.testing]
                );
                console.log("Inserted new review:", insertReviewResult);
            } else {
                await client.query(
                    `UPDATE opkn.reviews   
                     SET experience = $1,
                     education = $2,
                     technical_skills = $3,
                     soft_skills = $4,
                     motivation = $5,
                     testing = $6,
                     comment = $7
                     WHERE application_id = $8`,
                    [updatedData.experience, updatedData.education, updatedData.technical_skills, updatedData.soft_skills, updatedData.motivation, updatedData.testing, updatedData.comment, updatedData.application_id]
                );
            }
            const result3 = await client.query(
                `SELECT (r.experience + r.education + r.technical_skills + r.soft_skills + r.motivation + r.testing) / 6 AS average_score
                 FROM opkn.reviews AS r 
                 WHERE application_id = $1`,
                [updatedData.application_id]
            );
            let average = parseInt(result3.rows[0].average_score)
            console.log(average)
            const average_score = parseInt(average.toFixed(2));
            console.log(average_score);
            res.json({
                status: 'success',
                message: 'Updated successfully',
                data: average_score,
                application_id: updatedData.application_id
            });

        } catch (err) {
            return res.status(500).json({error: "Error while processing the request: " + err});
        } finally {
            done();
        }
    });
});

/* GET home page. */
router.get('/:id', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname,
        email: req.session.email
    }

    const jobId = req.params.id;
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query(`SELECT a.*,
                   j.title as job_title,
                   u.name as user_name,
                   u.surname as user_surname,
                   u.email as user_email,
                   u.profile_picture as user_profile_picture,
                   ap.name as status_name
                   FROM opkn.applications a
                   JOIN opkn.jobs j ON j.id = a.job_id 
                   JOIN opkn.users u ON u.id = a.user_id
                   JOIN opkn.application_status ap ON ap.id = a.status_id
                   WHERE a.job_id = $1
                   ORDER BY a.submitted_at DESC`, [jobId], async (err2, result2) => {
            done();
            if (err2) {
                console.error("Error while fetching applications", err2);
                return res.status(500).json({error: "Error while trying to fetch data (applications) " + err2})
            }

            await client.query(`SELECT * FROM opkn.jobs WHERE id = $1`, [jobId], async (err3, result3) => {
                if (err3)
                    return res.status(500).json({error: "Error while trying to fetch data (job) " + err3})
                await client.query(`SELECT * FROM opkn.application_status`, [], async (err4, result4) => {
                    if (err4)
                        return res.status(500).json({error: "Error while trying to fetch data (application status) " + err4})

                    const job = result3.rows[0];
                    const application_status = result4.rows;
                    const applications = result2.rows.map(event => {
                        const deadlineDate = new Date(event.submitted_at);

                        const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                        const formattedTimeDeadline = deadlineDate.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });

                        return {
                            ...event,
                            formattedDateDeadline,
                            formattedTimeDeadline
                        };
                    });
                    console.log("APPLICATIONS ", applications)

                    res.render('candidates', {
                        title: 'HRWorks',
                        user: user,
                        applications: applications,
                        job: job,
                        application_status: application_status
                    });
                });
            });
        });
    });
});

router.get('/ranking/:id', async function (req, res, next) {
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
        await client.query(`SELECT r.*,
                   a.id as application_id,
                   j.title as job_title,
                   u.id as user_id,
                   u.name as user_name,
                   u.surname as user_surname,
                   (r.experience + r.education + r.technical_skills + r.soft_skills + r.motivation + r.testing) / 6 as average_score
                   
                   FROM opkn.applications a
                   LEFT JOIN opkn.jobs j ON j.id = a.job_id 
                   LEFT JOIN opkn.users u ON u.id = a.user_id
                   LEFT JOIN opkn.reviews r on r.application_id = a.id
                          
                   WHERE a.job_id = $1
                   ORDER BY a.submitted_at DESC`, [jobId], async (err2, result2) => {
            done();
            if (err2)
                return res.status(500).json({error: "Error while trying to fetch data (ratings and reviews) " + err2})
            await client.query(`SELECT * FROM opkn.jobs WHERE id = $1`, [jobId], async (err3, result3) => {
                if (err3)
                    return res.status(500).json({error: "Error while trying to fetch data (job) " + err3})

                const job = result3.rows[0];
                const applications = result2.rows;

                console.log("DATA", applications);
                console.log("JOB", job);
                res.render('review_and_rating', {
                    title: 'HRWorks',
                    user: user,
                    applications: applications,
                    job: job
                });
            });
        });
    });
});

router.put('/update-status/:id', async (req, res) => {
    const applicationId = req.params.id;
    const {status, user_id, user_email, job_title} = req.body;
    console.log("STATUS, USERID, USER EMAIL, JOB TITLE ", status, user_id, user_email, job_title)

    let email_content;
    switch (status) {
        case "2":
            email_content = "Your application is being reviewed, expect further notifications soon.";
            break;
        case "3":
            email_content = "You have been selected for an interview, expect further instructions on interview date and other follow ups.";
            break;
        case "4":
            email_content = `Thank you for considering our company as potential employer. We appreciate the time and effort you put into this application.
                            Unfortunately we have had many applications and few candidates resonate with what we are searching for the most. 
                            We hope you will consider us in later job postings. Looking forward to working with you in the future. Best regards.`
            break;
        case "5":
            email_content = "You have been shortlisted. Expect further news soon. ";
            break;
        case "6":
            email_content = "Congratulations your applications has been approved and we officially welcome you to our team. We are delighted and can't wait for future collaborations!";
            break;

    }
    console.log("EMAIL CONTENT", email_content)

    try {
        const mailOptions = {
            from: {
                name: 'HRM',
                address: process.env.EMAIL
            }, // sender address
            to: user_email, // list of receivers
            subject: `Update on application for job: ${job_title}`, // Subject line text: "Hello world?", // plain text body
            text: email_content, // html body attachments
            replyTo: req.session.email
        }

        const query = 'UPDATE opkn.applications SET status_id = $1 WHERE id = $2';
        await req.pool.query(query, [status, applicationId]);
        if (status !== "1") {
            let emailTransporter = await createTransporter();
            await emailTransporter.sendMail(mailOptions);
            console.log("Email has been sent!");
        }
        res.status(200).json({message: 'Status updated and email sent successfully'});
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({error: 'Error updating status or sending email: ' + error.message});
    }
});

router.post("/send-email", async function (req, res, next) {
    const {subject, recipient, body, adminEmail} = req.body;
    console.log("DATA", req.body)
    const mailOptions = {
        from: {
            name: 'HRM',
            address: process.env.EMAIL
        }, // sender address
        to: recipient, // list of receivers
        subject: subject, // Subject line text: "Hello world?", // plain text body
        text: body, // html body attachments
        replyTo: adminEmail
    }

    const sendMail = async (mailOptions) => {
        let emailTransporter = await createTransporter();
        try {
            await emailTransporter.sendMail(mailOptions);
            console.log("Email has been sent!");
            res.json({success: true})
        } catch (error) {
            console.error(error);
        }
    }
    sendMail(mailOptions);
})

router.get('/filter/:selectedValue/:jobId', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname,
        email: req.session.email
    }
    const selectedValue = req.params.selectedValue;
    const job_id = req.params.jobId;
    console.log("SELCTED VALUE", selectedValue);
    let query;
    let array;
    query = `SELECT a.*,
                   j.title as job_title,
                   u.name as user_name,
                   u.surname as user_surname,
                   u.email as user_email,
                   u.profile_picture as user_profile_picture,
                   ap.name as status_name
                   FROM opkn.applications a
                   JOIN opkn.jobs j ON j.id = a.job_id 
                   JOIN opkn.users u ON u.id = a.user_id
                   JOIN opkn.application_status ap ON ap.id = a.status_id
                   WHERE a.job_id = $1 AND a.status_id = $2
                   ORDER BY a.submitted_at DESC`
    array = [job_id, selectedValue];
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database" + error})
        await client.query(query, array, async (error1, result) => {
            done();
            if (error1)
                return res.status(500).json({error: "Error while fetching data (applications) filter" + error})
            await client.query(`SELECT * FROM opkn.jobs WHERE id = $1`, [job_id], async (err3, result3) => {
                if (err3)
                    return res.status(500).json({error: "Error while trying to fetch data (job) " + err3})
                const job = result3.rows[0];
                const data = result.rows.map(event => {
                    const deadlineDate = new Date(event.submitted_at);

                    const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                    const formattedTimeDeadline = deadlineDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });

                    return {
                        ...event,
                        formattedDateDeadline,
                        formattedTimeDeadline
                    };
                });
                console.log("DATA", data)
                res.json({success: true, data: data, user: user, job: job})
            })
        })
    })
})


router.get('/filter_year/:selectedValue/:jobId', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname,
        email: req.session.email
    }
    const selectedValue = parseInt(req.params.selectedValue);
    const job_id = req.params.jobId;
    console.log("SELCTED VALUE", selectedValue);
    let sign;
    if (selectedValue === 0) {
        sign = "="
    } else {
        sign = ">="
    }
    let query;
    let array;
    query = `WITH experience_years AS (
              SELECT
                e.user_id,
                SUM(
                  CASE 
                    WHEN e.still_works = true THEN
                      EXTRACT(YEAR FROM CURRENT_DATE) - e.start_year
                    ELSE
                      e.end_year - e.start_year
                  END
                ) AS total_years_of_experience
              FROM opkn.experience e
              GROUP BY e.user_id
            )
            SELECT a.*,
                   j.title AS job_title,
                   u.name AS user_name,
                   u.surname AS user_surname,
                   u.email AS user_email,
                   u.profile_picture AS user_profile_picture,
                   ap.name AS status_name,
                   COALESCE(ey.total_years_of_experience, 0) AS years_of_experience
            FROM opkn.applications a
            JOIN opkn.jobs j ON j.id = a.job_id
            JOIN opkn.users u ON u.id = a.user_id
            JOIN opkn.application_status ap ON ap.id = a.status_id
            LEFT JOIN experience_years ey ON ey.user_id = u.id
            WHERE a.job_id = $1
              AND COALESCE(ey.total_years_of_experience, 0) ${sign} $2
            ORDER BY a.submitted_at DESC;
`
    array = [job_id, selectedValue];
    console.log("QUERY ARRAY", query, array)
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database" + error})
        await client.query(query, array, async (error1, result) => {
            done();
            if (error1)
                return res.status(500).json({error: "Error while fetching data (applications) filter" + error})
            await client.query(`SELECT * FROM opkn.jobs WHERE id = $1`, [job_id], async (err3, result3) => {
                if (err3)
                    return res.status(500).json({error: "Error while trying to fetch data (job) " + err3})
                const job = result3.rows[0];
                const data = result.rows.map(event => {
                    const deadlineDate = new Date(event.submitted_at);

                    const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                    const formattedTimeDeadline = deadlineDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });

                    return {
                        ...event,
                        formattedDateDeadline,
                        formattedTimeDeadline
                    };
                });
                console.log("DATA", data)
                console.log("JOB", job)
                res.json({success: true, data: data, user: user, job: job})
            })
        })
    })
})

module.exports = router;
