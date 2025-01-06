var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }


    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("SELECT * FROM opkn.users WHERE id = $1", [req.session.userId], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data (user) " + err})
            await client.query(`SELECT a.*,
                   j.title as job_title,
                   c.name as company_name,
                   c.image as company_image,
                   l.name as location_name,
                   s.name as status_name,
                   u.name as admin_name,
                   u.surname as admin_surname,
                   p.name as position_name,
                   ap.name as status_name
                   FROM opkn.applications a
                   JOIN opkn.jobs j ON j.id = a.job_id
                   JOIN opkn.companies c ON c.id = j.company_id
                   JOIN opkn.locations l ON l.id = j.location_id   
                   JOIN opkn.job_status s ON s.id = j.status  
                   JOIN opkn.users u ON u.id = j.admin_id
                   JOIN opkn.positions p ON p.id = j.position_id
                   JOIN opkn.application_status ap ON ap.id = a.status_id
                   WHERE a.user_id = $1
                   ORDER BY a.submitted_at DESC`, [req.session.userId], async (err2, result2) => {
                if (err2)
                    return res.status(500).json({error: "Error while trying to fetch data (applications) " + err2})

                const user_info = result.rows[0];
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
                console.log("USER ROLE", user.role);
                let profile_picture;
                if (user_info)
                    profile_picture = user_info.profile_picture;
                else profile_picture = '/images/default-profile.jfif';
                console.log("PROFILE PICTURE", profile_picture)

                res.render('applications', {
                    title: 'HRWorks',
                    user: user,
                    user_info: user_info,
                    profile_picture: profile_picture,
                    applications: applications,
                });
            });
        });
    });
});

module.exports = router;
