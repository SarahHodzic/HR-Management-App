var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:adminId', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }

    const adminId = req.params.adminId;

    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("SELECT * FROM opkn.users WHERE id = $1", [adminId], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data " + err})
            await client.query(`SELECT
                        (SELECT COUNT(*) FROM opkn.jobs WHERE admin_id = $1) AS total_job_posts,
                        (SELECT COUNT(a.id) 
                         FROM opkn.applications a
                         LEFT JOIN opkn.jobs j ON j.id = a.job_id 
                         WHERE j.admin_id = $1) AS total_applications,
                         (SELECT COUNT(a.id) 
                         FROM opkn.applications a
                         LEFT JOIN opkn.jobs j ON j.id = a.job_id 
                         WHERE j.admin_id = $1 AND a.status_id = 6) AS total_accepted_positions
                    `, [adminId], async (error1, result1) => {
                if (error1)
                    return res.status(500).json({error: "Error while trying to fetch data (card stats) " + error1})
                await client.query(`SELECT j.*,
                        (SELECT COUNT(a.id) 
                         FROM opkn.applications a
                         WHERE a.job_id = j.id) AS total_applications
                         FROM opkn.jobs j WHERE j.admin_id = $1
                    `, [adminId], async (error2, result2) => {
                    if (error2)
                        return res.status(500).json({error: "Error while trying to fetch data (applications per post) " + error2})
                    const stats_info = result1.rows[0];
                    let job_name = [];
                    let application_number = [];
                    console.log("APPLICATIONS PER POST", result2.rows);
                    result2.rows.forEach(el => {
                        job_name.push(el.id);
                        application_number.push(parseInt(el.total_applications, 10) || 0);
                    });
                    const jobs = result2.rows;
                    console.log("JOBS ", job_name)
                    console.log("NUMBER OF APPLICATIONS ", application_number)

                    console.log("STATS", stats_info);


                    const user_info = result.rows[0];

                    res.render('admin_panel', {
                        title: 'Admin Panel | HRWorks',
                        user: user,
                        user_info: user_info,
                        profile_picture: user_info.profile_picture,
                        stats_info: stats_info,
                        job_name: job_name,
                        application_number: application_number,
                        jobs: jobs
                    });
                });
            });
        });
    });
});

router.post("/pie_chart", async function (req, res, next) {
    const jobId = req.body.jobId;
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query(`SELECT 
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

            const rating = result2.rows;
            let users = [];
            let ratings = [];
            console.log("USER RATINGS", rating);
            result2.rows.forEach(el => {
                users.push(el.user_name + " " + el.user_surname);
                ratings.push(parseInt(el.average_score, 10) || 0);
            });
            console.log("USERS: ", users);
            console.log("RATINGS: ", ratings);
            return res.json({success: true, ratings: ratings, users: users})
        });
    });
});


module.exports = router;
