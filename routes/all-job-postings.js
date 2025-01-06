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
        await client.query(`SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            u.name as admin_name,
                            u.surname as admin_surname,
                            p.name as position_name
                            FROM opkn.jobs j 
                            LEFT JOIN opkn.companies c ON c.id = j.company_id
                            LEFT JOIN opkn.locations l ON l.id = j.location_id   
                            LEFT JOIN opkn.job_status s ON s.id = j.status  
                            LEFT JOIN opkn.users u ON u.id = j.admin_id
                            LEFT JOIN opkn.positions p ON p.id = j.position_id `, [], (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data " + err})

            const jobs = result.rows.map(event => {
                const deadlineDate = new Date(event.deadline);

                // date: day-month-year
                const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                // time: hours:minutes AM/PM
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

            console.log("JOBS", jobs)

            res.render('all_job_postings', {title: 'HRWorks', user: user, jobs: jobs});
        })
    })
});

router.get('/filter/:selectedValue', async function (req, res, done) {
    const selectedValue = req.params.selectedValue;
    console.log("SELCTED VALUE", selectedValue);
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database" + error})
        await client.query(`SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            u.name as admin_name,
                            u.surname as admin_surname,
                            p.name as position_name 
                            FROM opkn.jobs j 
                            LEFT JOIN opkn.companies c ON c.id = j.company_id
                            LEFT JOIN opkn.locations l ON l.id = j.location_id   
                            LEFT JOIN opkn.job_status s ON s.id = j.status  
                            LEFT JOIN opkn.users u ON u.id = j.admin_id
                            LEFT JOIN opkn.positions p ON p.id = j.position_id
                            WHERE j.status = $1`, [selectedValue], (error1, result) => {
            done();
            if (error1)
                return res.status(500).json({error: "Error while fetching data" + error})

            const data = result.rows.map(event => {
                const deadlineDate = new Date(event.deadline);

                // date: day-month-year
                const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                // time: hours:minutes AM/PM
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
            res.json({success: true, data: data})
        })
    })
})

router.get('/sort/:selectedValue', async function (req, res, done) {
    const selectedValue = req.params.selectedValue;
    console.log("SELCTED VALUE", selectedValue);

    let query = `
                      SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            u.name as admin_name,
                            u.surname as admin_surname,
                            p.name as position_name 
                            FROM opkn.jobs j 
                            LEFT JOIN opkn.companies c ON c.id = j.company_id
                            LEFT JOIN opkn.locations l ON l.id = j.location_id   
                            LEFT JOIN opkn.job_status s ON s.id = j.status  
                            LEFT JOIN opkn.users u ON u.id = j.admin_id
                            LEFT JOIN opkn.positions p ON p.id = j.position_id 
                    `;

    switch (selectedValue) {
        case "1":
            query += "ORDER BY j.deadline DESC"; // Deadline Descending
            break;
        case "2":
            query += "ORDER BY j.deadline ASC";  // Deadline Ascending
            break;
        case "3":
            query += "ORDER BY j.created_at DESC"; // Created At Descending
            break;
        case "4":
            query += "ORDER BY j.created_at ASC";  // Created At Ascending
            break;
        default:
            query += "ORDER BY j.deadline DESC"; // Default sorting
    }
    console.log("QUERY ", query);
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database" + error})
        await client.query(query, [], (error1, result) => {
            done();
            if (error1)
                return res.status(500).json({error: "Error while fetching data" + error})
            const data = result.rows.map(event => {
                const deadlineDate = new Date(event.deadline);

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
            res.json({success: true, data: data})
        })
    })
});

router.post('/search', async (req, res) => {
    const searchTerm = req.body.searchTerm;

    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const queryJobs = {
        text: `SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            u.name as admin_name,
                            u.surname as admin_surname,
                            p.name as position_name 
                            FROM opkn.jobs j 
                            JOIN opkn.companies c ON c.id = j.company_id
                            JOIN opkn.locations l ON l.id = j.location_id   
                            JOIN opkn.job_status s ON s.id = j.status  
                            JOIN opkn.users u ON u.id = j.admin_id
                            JOIN opkn.positions p ON p.id = j.position_id 
           WHERE j.title ILIKE $1 OR l.name ILIKE $1 OR c.name ILIKE $1 OR CONCAT(u.name, ' ', u.surname) ILIKE $1 OR p.name ILIKE $1`,
        values: [`%${searchTerm}%`],
    };
    const queryUser = {
        text: 'SELECT * FROM opkn.users WHERE id = $1',
        values: [req.session.userId],
    };

    try {
        const [jobsResult, userResult] = await Promise.all([
            req.pool.query(queryJobs),
            req.pool.query(queryUser),
        ]);

        const jobs = jobsResult.rows.map(event => {
            const deadlineDate = new Date(event.deadline);

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
        const user_admin = userResult.rows[0];
        res.render('all_job_postings', {
            title: 'HRWorks',
            user: user,
            jobs: jobs,
            user_admin: user_admin,
        });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).send('Internal Server Error', err);
    }
});

module.exports = router;
