var express = require('express');
var router = express.Router();
const multer = require('multer');
const path = require('path');
const saltRounds = 10;
const bcrypt = require("bcrypt");

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


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/profile_photo'));
    },
    filename: function (req, file, cb) {
        cb(null, `${req.params.userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const storage_cover_photo = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/cover_photo'));
    },
    filename: function (req, file, cb) {
        cb(null, `${req.params.userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const storage_documents = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/documents'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});


const upload = multer({storage: storage});
const upload_cover_photo = multer({storage: storage_cover_photo});
const upload_documents = multer({storage: storage_documents});


/* GET organiser profile page. */
router.get('/:user_id', async function (req, res, next) {
    const userId = req.params.user_id;

    await req.pool.connect(async (error, client, done) => {
        if (error) {
            return res.status(500).json({error: "Error while trying to connect on database: " + error});
        }

        const query = `
      SELECT * FROM opkn.users WHERE id = $1
    `;
        const values = [userId];
        await client.query(query, values, async (err, result) => {
            done();
            if (err) {
                return res.status(500).json({error: 'Error while fetching data(user) from database: ' + err});
            }

            if (result.rows.length === 0) {
                return res.status(404).json({error: "User not found."});
            }

            await client.query("SELECT * FROM opkn.documents WHERE user_id = $1", [userId], async (err1, result1) => {

                if (err1)
                    return res.status(500).json({error: 'Error while fetching data(documents) from database: ' + err1});

                await client.query(`SELECT 
                               e.* ,
                               et.name as employment_name              
                               FROM opkn.experience e 
                               LEFT JOIN opkn.employment_type et ON et.id = e.employment_type_id 
                               WHERE e.user_id = $1`, [userId], async (err2, result2) => {
                    if (err2)
                        return res.status(500).json({error: 'Error while fetching data(experience) from database: ' + err2});

                    await client.query(`SELECT 
                               *             
                               FROM opkn.education                                 
                               WHERE user_id = $1`, [userId], async (err3, result3) => {
                        if (err3)
                            return res.status(500).json({error: 'Error while fetching data(education) from database: ' + err3});

                        await client.query(`SELECT 
                               *             
                               FROM opkn.skills                                 
                               WHERE user_id = $1`, [userId], async (err4, result4) => {
                            if (err4)
                                return res.status(500).json({error: 'Error while fetching data(skill) from database: ' + err4});

                            await client.query(`SELECT r.*,
                                            COALESCE((SELECT AVG(rating)
                                            FROM opkn.interviews 
                                            WHERE $1 = user_id), 0) AS average_rating,
                                            u.name,
                                            u.surname
                                            FROM opkn.interviews r
                                            LEFT JOIN opkn.users u on u.id = r.admin_id
                                            WHERE r.user_id = $1`, [userId], (error5, result5) => {
                                if (error5)
                                    return res.status(500).json({error: "Error while fetching data from database (interview rating) " + error5})

                                const experience = result2.rows;
                                const documents = result1.rows;
                                const user = result.rows[0];
                                const education = result3.rows;
                                const skills = result4.rows;

                                console.log("USER", user)
                                console.log("DOCUMENTS", documents)
                                console.log("EXPERIENCE", experience)
                                console.log("EDUCATION", education);

                                const review = result5.rows;
                                const average_rating = review.length > 0 ? review[0].average_rating : 0;
                                console.log("AVERAGE", average_rating)
                                console.log(typeof average_rating, average_rating);

                                const rounded_average = typeof average_rating === 'number'
                                    ? parseFloat(average_rating.toFixed(1))
                                    : typeof average_rating === 'string'
                                        ? parseFloat(parseFloat(average_rating).toFixed(1))
                                        : 0;

                                console.log("REVIEWS ", review)
                                console.log("AVERAGE", rounded_average)

                                res.render('user_profile', {
                                    title: 'HRWorks',
                                    name: req.session.name,
                                    surname: req.session.surname,
                                    email: req.session.email,
                                    userId: req.session.userId,
                                    userRole: req.session.userRole,
                                    user: user,
                                    profilePicture: user.profile_picture || '/images/default-profile.jfif',
                                    backgroundPicture: user.background_image || '/images/default-background.jpg',
                                    documents: documents,
                                    experience: experience,
                                    education: education,
                                    skills: skills,
                                    review: review,
                                    average_rating: rounded_average,
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

/* POST profile photo */
router.post('/profile-photo/:userId', upload.single('profilePhoto'), async function (req, res) {
    const userId = req.params.userId;

    if (!req.file) {
        return res.status(400).json({error: 'No file uploaded'});
    }

    const profilePhotoPath = `/profile_photo/${req.file.filename}`;
    console.log("profilePohotoPath", profilePhotoPath);

    try {
        const client = await req.pool.connect();
        const query = 'UPDATE opkn.users SET profile_picture = $1 WHERE id = $2';
        const values = [profilePhotoPath, userId];

        await client.query(query, values);
        client.release();

        res.status(200).json({message: 'Profile picture updated successfully', profilePicture: profilePhotoPath});
    } catch (error) {
        res.status(500).json({error: 'Error updating profile picture: ' + error});
    }
});

/* POST cover photo */
router.post('/cover-photo/:userId', upload_cover_photo.single('coverPhoto'), async function (req, res) {
    const userId = req.params.userId;
    if (!req.file) {
        return res.status(400).json({error: 'No file uploaded'});
    }

    const coverPhotoPath = `/cover_photo/${req.file.filename}`;
    console.log("coverPhotoPath", coverPhotoPath);

    try {
        const client = await req.pool.connect();
        const query = 'UPDATE opkn.users SET background_image = $1 WHERE id = $2';
        const values = [coverPhotoPath, userId];

        await client.query(query, values);
        client.release();

        res.status(200).json({message: 'Cover picture updated successfully', profilePicture: coverPhotoPath});
    } catch (error) {
        res.status(500).json({error: 'Error updating profile picture: ' + error});
    }
});

/* POST edit profile*/
router.post('/edit-profile/:userId', async function (req, res) {
    const userId = req.params.userId;
    const data = req.body;
    const hashedPassword = await getHashedPassword(data.password);

    try {
        const client = await req.pool.connect();
        try {
            const query = `UPDATE opkn.users SET email = $1, password = $2, name = $3, surname = $4, phone = $5, description = $6 WHERE id = $7`;
            const values = [data.email, hashedPassword, data.name, data.surname, data.phone, data.description, userId];
            await client.query(query, values);
            res.redirect(`/user_profile/${userId}`);
        } catch (queryError) {
            res.status(500).send("Error during profile update: " + queryError);
        } finally {
            client.release();
        }
    } catch (connectionError) {
        res.status(500).send("Error connecting to the database: " + connectionError);
    }
});

/*POST documents*/
router.post('/upload/:userId', upload_documents.single('document'), async (req, res) => {
    const userId = req.params.userId;
    if (!req.file) {
        return res.status(400).send({success: false, message: 'No file uploaded'});
    }

    const fileUrl = `/documents/${req.file.filename}`;
    console.log("FILE URL", fileUrl);
    try {
        const client = await req.pool.connect();
        const query = `INSERT INTO opkn.documents (user_id, document, file_name) values($1, $2, $3)`;
        const values = [userId, fileUrl, req.file.originalname];

        await client.query(query, values);
        console.log("File info saved to database");
        client.release();

        res.status(200).json({
            success: true,
            fileUrl: fileUrl,
            fileName: req.file.originalname
        });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({error: 'Error inserting documents: ' + error});
    }
});

/* POST add experience */
router.post('/add-experience/:userId', async function (req, res) {
    const userId = req.params.userId;
    const data = req.body.data;
    const currentRole = req.body.currentRole;
    const employment_type_int = Number(data.employment_type);
    console.log("DATA: ", data);
    console.log("CURRENT ROLE: ", currentRole);
    console.log(data.employment_type, employment_type_int)


    try {
        const client = await req.pool.connect();
        try {
            const query = `INSERT INTO opkn.experience(user_id, title, employment_type_id, company_name, start_month, start_year, end_month, end_year, still_works) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`;
            const values = [userId, data.title, employment_type_int, data.company_name, data.start_month, data.start_year, data.end_month, data.end_year, currentRole];
            const result = await client.query(query, values);

            const experienceId = result.rows[0].id;
            const employmentTypeQuery = `SELECT e.*, et.name as employment_name
                                         FROM opkn.experience e
                                         LEFT JOIN opkn.employment_type et ON e.employment_type_id = et.id
                                         WHERE e.id = $1;
                                        `;
            const finalResult = await client.query(employmentTypeQuery, [experienceId]);

            res.status(200).json(finalResult.rows[0]);
        } catch (queryError) {
            res.status(500).send("Error during adding experience " + queryError);
        } finally {
            client.release();
        }
    } catch (connectionError) {
        res.status(500).send("Error connecting to the database: " + connectionError);
    }
});

/*DELETE experience */
router.delete('/delete-experience/:id', async (req, res) => {
    const experienceId = req.params.id;
    const client = await req.pool.connect();

    console.log("experienceId", experienceId)
    try {
        await client.query(`DELETE FROM opkn.experience WHERE id = $1`, [experienceId]);
        res.json({success: true});
    } catch (err) {
        console.error('Error while deleting experience:', err);
        res.status(500).json({success: false, error: 'Failed to delete experience'});
    } finally {
        client.release();
    }
});

//EDIT experience
router.put('/edit-experience/:id', async (req, res) => {
    const experienceId = req.params.id;
    const {
        title,
        employment_type_id,
        company_name,
        current_role,
        start_month,
        start_year,
        end_month,
        end_year
    } = req.body;
    const client = await req.pool.connect();
    console.log(title, employment_type_id, company_name, current_role, start_month, start_year, end_month, end_year);
    try {
        if (!current_role) {
            await client.query(`UPDATE opkn.experience
             SET title = $1, employment_type_id = $2, company_name = $3, still_works = $4, start_month = $5, start_year = $6, end_month = $7, end_year = $8
             WHERE id = $9`, [title, employment_type_id, company_name, current_role, start_month, start_year, end_month, end_year, experienceId]);
        } else {
            await client.query(`UPDATE opkn.experience
             SET title = $1, employment_type_id = $2, company_name = $3, still_works = false, start_month = $4, start_year = $5
             WHERE id = $6`, [title, employment_type_id, company_name, start_month, start_year, experienceId]);
        }
        res.json({success: true});
    } catch (err) {
        console.error('Error while Editing event:', err);
        res.status(500).json({success: false, error: 'Failed to edit event'});
    } finally {
        client.release();
    }
});

// Add education
router.post('/add-education/:userId', async function (req, res) {
    const userId = req.params.userId;
    const data = req.body;
    console.log("DATA: ", data);

    try {
        const client = await req.pool.connect();
        try {
            const query = `INSERT INTO opkn.education(user_id, school, degree, field_of_study, start_month, start_year, end_month, end_year) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
            const values = [userId, data.school, data.degree, data.field_of_study, data.start_month, data.start_year, data.end_month, data.end_year];
            const result = await client.query(query, values);

            res.status(200).json(result.rows[0]);
        } catch (queryError) {
            res.status(500).send("Error during adding education " + queryError);
        } finally {
            client.release();
        }
    } catch (connectionError) {
        res.status(500).send("Error connecting to the database: " + connectionError);
    }
});

/*DELETE education */
router.delete('/delete-education/:id', async (req, res) => {
    const educationId = req.params.id;
    const client = await req.pool.connect();

    console.log("experienceId", educationId)
    try {
        await client.query(`DELETE FROM opkn.education WHERE id = $1`, [educationId]);
        res.json({success: true});
    } catch (err) {
        console.error('Error while deleting education:', err);
        res.status(500).json({success: false, error: 'Failed to delete education'});
    } finally {
        client.release();
    }
});

//EDIT education
router.put('/edit-education/:id', async (req, res) => {
    const educationId = req.params.id;
    const {school, degree, field_of_study, start_month, start_year, end_month, end_year} = req.body;
    const client = await req.pool.connect();
    console.log(school, degree, field_of_study, start_month, start_year, end_month, end_year);
    try {
        await client.query(`UPDATE opkn.education
        SET school = $1, degree = $2, field_of_study = $3, start_month = $4, start_year = $5, end_month = $6, end_year = $7
        WHERE id = $8`, [school, degree, field_of_study, start_month, start_year, end_month, end_year, educationId]);

        res.json({success: true});
    } catch (err) {
        console.error('Error while Editing education:', err);
        res.status(500).json({success: false, error: 'Failed to edit education'});
    } finally {
        client.release();
    }
});

/* POST add skill */
router.post('/add-skill/:userId', async function (req, res) {
    const userId = req.params.userId;
    const data = req.body;
    console.log("DATA: ", data);
    try {
        const client = await req.pool.connect();
        try {
            const query = `INSERT INTO opkn.skills(user_id, name) VALUES($1,$2) RETURNING *`;
            const values = [userId, data.skill];
            const result = await client.query(query, values);

            res.status(200).json(result.rows[0]);
        } catch (queryError) {
            res.status(500).send("Error during adding skill " + queryError);
        } finally {
            client.release();
        }
    } catch (connectionError) {
        res.status(500).send("Error connecting to the database: " + connectionError);
    }
});

/*DELETE skill */
router.delete('/delete-skill/:id', async (req, res) => {
    const skillId = req.params.id;
    const client = await req.pool.connect();

    console.log("SkillId", skillId)
    try {
        await client.query(`DELETE FROM opkn.skills WHERE id = $1`, [skillId]);
        res.json({success: true});
    } catch (err) {
        console.error('Error while deleting skill:', err);
        res.status(500).json({success: false, error: 'Failed to delete skill'});
    } finally {
        client.release();
    }
});

//EDIT skill
router.put('/edit-skill/:id', async (req, res) => {
    const skillId = req.params.id;
    const {skill} = req.body;
    const client = await req.pool.connect();
    console.log(skill);
    try {
        await client.query(`UPDATE opkn.skills
        SET name = $1
        WHERE id = $2`, [skill, skillId]);

        res.json({success: true});
    } catch (err) {
        console.error('Error while Editing skill:', err);
        res.status(500).json({success: false, error: 'Failed to edit skill'});
    } finally {
        client.release();
    }
});

router.post("/rating", async function (req, res, next) {
    const {rating, feedback, adminId, userId} = req.body;
    console.log("DATA", rating, feedback, adminId, userId);
    await req.pool.connect(async (error, client, done) => {
        if (error)
            return res.status(500).json({error: "Error while trying to connect on database" + error})
        await client.query("INSERT INTO opkn.interviews (user_id, admin_id, rating, feedback) VALUES ($1, $2, $3, $4)", [userId, adminId, rating, feedback], async (error1, result) => {
            done();
            if (error1)
                res.json({success: false, error: error1})
            await client.query(`SELECT AVG(rating) as average_rating FROM opkn.interviews WHERE user_id = $1`, [userId], (error2, result2) => {
                if (error2)
                    res.json({success: false, error: error2})
                const average_rating = result2.rows[0].average_rating
                const rounded_average = typeof average_rating === 'number'
                    ? parseFloat(average_rating.toFixed(1))
                    : typeof average_rating === 'string'
                        ? parseFloat(parseFloat(average_rating).toFixed(1))
                        : 0;
                console.log("AVERAGE RATING", average_rating)
                res.json({
                    success: true, average_rating: rounded_average, name: req.session.name,
                    surname: req.session.surname,
                })
            })
        })
    })
})


module.exports = router;
