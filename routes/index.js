var express = require('express');
var router = express.Router();


// Archieve posts deadline is over
async function archiveExpiredJobs(pool) {
    return new Promise((resolve, reject) => {
        pool.connect((error, client, done) => {
            if (error) {
                done();
                return reject("Error while trying to connect to database " + error);
            }

            client.query(`
                UPDATE opkn.jobs
                SET status = 2
                WHERE deadline <= NOW() AND status != 2;
            `, (err, result) => {
                done();
                if (err) {
                    return reject("Error while trying to update job postings " + err);
                }
                resolve(result.rowCount);
            });
        });
    });
}

/* GET home page. */
router.get('/', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }

    const archivedJobsCount = await archiveExpiredJobs(req.pool);
    console.log(`${archivedJobsCount} job postings archived.`);

    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("SELECT * FROM opkn.users WHERE id = $1", [req.session.userId], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data " + err})
            await client.query("SELECT * FROM opkn.companies", [], async (err1, result1) => {
                if (err1)
                    return res.status(500).json({error: "Error while trying to fetch data (companies) " + err1})
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
                            WHERE j.status = 1
                            ORDER BY j.created_at DESC`, [], async (err2, result2) => {
                    if (err2)
                        return res.status(500).json({error: "Error while trying to fetch data (jobs) " + err2})
                    await client.query("SELECT * FROM opkn.positions", [], async (err3, result3) => {
                        if (err3)
                            return res.status(500).json({error: "Error while trying to fetch data (positions) " + err3})

                        const companies = result1.rows;
                        const user_info = result.rows[0];
                        const job_postings = result2.rows.map(event => {
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
                        const positions = result3.rows;
                        console.log("USER ROLE", user.role);
                        let profile_picture;
                        if (user_info)
                            profile_picture = user_info.profile_picture;
                        else profile_picture = '/images/default-profile.jfif';
                        console.log("PROFILE PICTURE", profile_picture)

                        res.render('home', {
                            title: 'HRWorks',
                            user: user,
                            user_info: user_info,
                            profile_picture: profile_picture,
                            companies: companies,
                            jobs: job_postings,
                            positions: positions
                        });
                    });
                });
            });
        });
    });
});


router.get('/filter/:selectedValue', async function (req, res, done) {
    const selectedValue = req.params.selectedValue;
    console.log("SELCTED VALUE", selectedValue);
    let query;
    let array;
    if (selectedValue === '0') {
        query = `SELECT j.*,
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
                 WHERE j.status = 1`
        array = [];
    } else {
        query = `SELECT j.*,
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
                 WHERE j.position_id = $1 AND j.status = 1`
        array = [selectedValue];
    }
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect to database" + error})
        await client.query(query, array, (error1, result) => {
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
                            WHERE j.status = 1
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

router.get('/filter_company/:selectedValue', async function (req, res, done) {
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
                             WHERE j.company_id = $1 AND j.status = 1`, [selectedValue], (error1, result) => {
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
})

module.exports = router;
