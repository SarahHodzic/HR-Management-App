var express = require('express');
var router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');

//Generate PDF Report Function
const generateReport = (job_info, user_info, final_ranking, callback) => {
    const doc = new PDFDocument();
    const fileName = `report-${job_info.id}.pdf`;
    const writeStream = fs.createWriteStream(fileName);

    doc.pipe(writeStream);

    doc.fontSize(20).text(`Report for Contest: ${job_info.title}`, { align: 'center', underline: true });
    doc.moveDown();

    doc.fontSize(14).text(`Status: ${job_info.status_name}`, { continued: true }).text(`   Position: ${job_info.position_name}`);
    doc.fontSize(14).text(`Company: ${job_info.company_name}`);
    doc.fontSize(14).text(`Location: ${job_info.location_name}`);
    doc.fontSize(12).text(`HR Manager Info: ${job_info.admin_name} ${job_info.admin_surname} (${job_info.admin_email})`);
    doc.moveDown();
    doc.fontSize(12).text(`Description: ${job_info.description}`, { align: 'justify' });
    doc.moveDown();

    doc.fontSize(16).text('Candidate Details:', { underline: true });
    user_info.forEach((candidate, index) => {
        doc.moveDown();
        doc.fontSize(14).text(`${index + 1}. ${candidate.user_name} ${candidate.user_surname}`);
        doc.fontSize(12).text(`Email: ${candidate.user_email}`);
        doc.text(`Phone: ${candidate.user_phone}`);
        doc.text(`Application Status: ${candidate.application_status}`);
        doc.text(`Technical Skills: ${candidate.technical_skills}`);
        doc.text(`Soft Skills: ${candidate.soft_skills}`);
        doc.text(`Motivation: ${candidate.motivation}`);
        doc.text(`Testing: ${candidate.testing}`);
        doc.text(`Experience: ${candidate.experience}`);
        doc.text(`Education: ${candidate.education}`);
        const averageScore = candidate.average_score !== null ? candidate.average_score.toFixed(2) : 'N/A';
        doc.text(`Average Score: ${averageScore}`);
        doc.text(`Comment: ${candidate.comment}`);
        doc.moveDown();
    });

    doc.addPage();
    doc.fontSize(16).text('Final Rankings:', { underline: true, align: 'center' });
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(12).text('Rank', 50, tableTop);
    doc.text('Name', 100, tableTop);
    doc.text('Score', 350, tableTop);
    doc.moveDown();

    final_ranking.forEach((candidate, index) => {
        const y = tableTop + 25 + index * 20;
        const averageScore = candidate.average_score !== null ? candidate.average_score.toFixed(2) : 'N/A';
        doc.text(index + 1, 50, y);
        doc.text(`${candidate.user_name} ${candidate.user_surname}`, 100, y);
        doc.text(averageScore, 350, y);
    });

    doc.end();

    writeStream.on('finish', () => {
        callback(null, fileName);
    });

    writeStream.on('error', (err) => {
        callback(err);
    });
};


/* GET home page. */
router.get('/', async function(req, res, next) {
    const user = {
        id : req.session.userId,
        role : req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    await req.pool.connect(async (error, client, done) => {
        if(error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query("SELECT * FROM opkn.companies",[], async (err, result) => {
            done();
            if (err)
                return res.status(500).json({error: "Error while trying to fetch data(companies) " + err})
            await client.query("SELECT * FROM opkn.locations",[], async (err1, result1) => {
                if (err1)
                    return res.status(500).json({error: "Error while trying to fetch data(locations) " + err1})
                await client.query("SELECT * FROM opkn.positions",[], async (err2, result2) => {
                    if (err2)
                        return res.status(500).json({error: "Error while trying to fetch data(positions) " + err2})

            const companies = result.rows;
            const locations = result1.rows;
            const positions = result2.rows;
            console.log("COMPANIES", companies);
            console.log("LOCATIONS", locations);
            console.log("POSITIONS", positions);

            res.render('contest', {title: 'New Contest | HRWorks', user: user, companies: companies, locations: locations, positions: positions});
        });
    });
    });
    });
});

/* Create job posting */
router.post("/create-job/:id", async function(req,res,next){
    const adminId = req.params.id;
    const data = req.body;
    console.log("DATA", data);
    const fieldNames = req.body['field_name[]'];
    const fieldTypes = req.body['field_type[]'];
    const fieldRequired = req.body['field_required[]'];
    const documents = req.body['document_required[]'];


    await req.pool.connect(async (error,client,done) => {
        if(error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query('INSERT INTO opkn.jobs(title,description,company_id,location_id,deadline,admin_id,position_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *'
                            ,[data.title, data.description, data.company_id, data.location_id, data.deadline, adminId, data.position_id], async(err, result) =>{
            done();
            if(err)
                return res.status(500).json({error: "Error while trying to insert data (job posting)" + err})
                const job_id = result.rows[0].id;

            if(documents) {
                for (let i = 0; i < documents.length; i++) {
                    const fieldName = documents[i];
                    const isRequired = true;
                    const fieldType = 'file';

                    await client.query(
                        `INSERT INTO opkn.job_fields (job_id, field_name, is_required, field_type) 
                         VALUES ($1, $2, $3, $4)`,
                        [job_id, fieldName, isRequired, fieldType]
                    );
                }
            }

                if(fieldNames) {
                    for (let i = 0; i < fieldNames.length; i++) {
                        const name = fieldNames[i];
                        const type = fieldTypes[i];
                        const isRequired = fieldRequired[i] === 'true';

                        await client.query(
                            `INSERT INTO opkn.job_fields (job_id, field_name, is_required, field_type) 
                            VALUES ($1, $2, $3, $4)`,
                            [job_id, name, isRequired, type], (err1, result1) => {
                                if (err1)
                                    return res.status(500).json({error: "Error while trying to insert data (job field)" + err})
                            }
                        );
                    }
                }
                res.redirect(`/contest/my-job-postings/${adminId}`)
        });
    })
});

/* Job Postings For Each Admin */
router.get("/my-job-postings/:id",async function(req,res,next){
    const user = {
        id : req.session.userId,
        role : req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const adminId = req.params.id;
    await req.pool.connect(async (error,client,done) => {
        if(error)
            return res.status(500).json({error: "Error while trying to connect to database " + error})
        await client.query(`SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            p.name as position_name 
                            FROM opkn.jobs j 
                            LEFT JOIN opkn.companies c ON c.id = j.company_id
                            LEFT JOIN opkn.locations l ON l.id = j.location_id   
                            LEFT JOIN opkn.job_status s ON s.id = j.status  
                            LEFT JOIN opkn.positions p ON p.id = j.position_id                                        
                            WHERE j.admin_id = $1`,[adminId], (err, result) => {
            if(err)
                return res.status(500).json({error: "Error while trying to fetch data (job postings) " + err})
            const job_postings = result.rows.map(event => {
                const deadlineDate = new Date(event.deadline);

                const formattedDate = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                const formattedTime = deadlineDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                return {
                    ...event,
                    formattedDate,
                    formattedTime
                };
            });

            console.log("JOB POSTiNGS", job_postings)
            res.render("my_job_postings", {title: "My Job Postings | HRWorks", user: user, jobs: job_postings})

        });
    });

});

/* GET individual job posting */
router.get("/individual-job-posting/:id", async function(req,res,next){
    const user = {
        id : req.session.userId,
        role : req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const jobId = req.params.id;

   await req.pool.connect(async (error, client, done)=>{
       if(error)
           return res.status(500).json({error: "Error while trying to connect on database" + error});
       await client.query(`SELECT j.*,
                            c.name as company_name,
                            c.image as company_image,
                            l.name as location_name,
                            s.name as status_name,
                            u.id as admin_id,
                            u.name as admin_name,
                            u.surname as admin_surname,
                            u.email as admin_email,
                            p.name as position_name 
                            FROM opkn.jobs j 
                            LEFT JOIN opkn.companies c ON c.id = j.company_id
                            LEFT JOIN opkn.locations l ON l.id = j.location_id   
                            LEFT JOIN opkn.job_status s ON s.id = j.status  
                            LEFT JOIN opkn.users u ON u.id = j.admin_id 
                            LEFT JOIN opkn.positions p ON p.id = j.position_id                                         
                            WHERE j.id = $1`,[jobId],(err,result)=>{
           if(err)
               return res.status(500).json({error: "Error while fetching data" + err});
           const event = result.rows[0];

               const deadlineDate = new Date(event.deadline);
               const createdAt = new Date(event.created_at);

               const formattedDateDeadline = deadlineDate.toLocaleDateString('en-GB').replace(/\//g, '.');
               const formattedDateCreatedAt = createdAt.toLocaleDateString('en-GB').replace(/\//g, '.');

               const formattedTimeDeadline = deadlineDate.toLocaleTimeString('en-US', {
                   hour: '2-digit',
                   minute: '2-digit',
                   hour12: true
               });
               const formattedTimeCreatedAt = createdAt.toLocaleTimeString('en-US', {
                   hour: '2-digit',
                   minute: '2-digit',
                   hour12: true
               });

               const job_posting =  {
                   ...event,
                   formattedDateDeadline,
                   formattedTimeDeadline,
                   formattedDateCreatedAt,
                   formattedTimeCreatedAt
               };
           res.render("individual_job_posting",{title: "HRWorks", job: job_posting, user: user})
       })
   })
});

router.put('/update-status/:id', async (req, res) => {
    const jobId = req.params.id;
    const { status } = req.body;

    try {
        const query = 'UPDATE opkn.jobs SET status = $1 WHERE id = $2';
        await req.pool.query(query, [status, jobId]);
        res.status(200).json({ message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating status: ' + error.message });
    }
});

/*Get edit form for individual job*/
router.get("/edit-job/:id", async function(req,res,next){
    const user = {
        id : req.session.userId,
        role : req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const jobId = req.params.id;
   await req.pool.connect(async (error, client, done) => {
       if(error)
           return res.status(500).json({error: "Error while trying to connect on database" + error});
       await client.query(`SELECT j.* FROM opkn.jobs j WHERE j.id = $1`,[jobId], async (err,result)=>{
           done();
            if(err)
                return res.status(500).json({error: "Error while fetching data (job posting) " + err})
           await client.query(`SElECT * FROM opkn.companies`,[], async (err1, result1) => {
               if(err1)
                   return res.status(500).json({error: "Error while fetching data (companies) " + err1})
               await client.query(`SElECT * FROM opkn.locations`,[], async (err2, result2) => {
                   if(err2)
                       return res.status(500).json({error: "Error while fetching data (locations) " + err2})
                   await client.query(`SElECT * FROM opkn.positions`,[], async (err3, result3) => {
                       if(err3)
                           return res.status(500).json({error: "Error while fetching data (positions) " + err3})

                   const event = result.rows[0];
                   const deadlineDate = new Date(event.deadline);

                   const year = deadlineDate.getFullYear();
                   const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
                   const day = String(deadlineDate.getDate()).padStart(2, '0');
                   const hours = String(deadlineDate.getHours()).padStart(2, '0');
                   const minutes = String(deadlineDate.getMinutes()).padStart(2, '0');
                   const formattedDeadline = `${year}-${month}-${day}T${hours}:${minutes}`;

                   const job = {
                       ...event,
                       formattedDeadline,
                   };
                   const companies = result1.rows;
                   const locations = result2.rows;
                   const positions = result3.rows;

                   res.render("edit_individual_job_posting", {title: "HRWorks", user: user, job: job, companies: companies, locations: locations, positions: positions})
           });
           });
      });
   });
});
});

/*EDIT job posting */
router.post('/edit-job/:id', async function(req, res) {
    const jobId = req.params.id;
    const data = req.body;
    console.log("DATA: ", data);
    try {
        const deadline = new Date(data.deadline);
        const now = new Date();

        let status = 2;
        if (deadline > now) {
            status = 1;
        }
        const client = await req.pool.connect();
        try {
            const query = `UPDATE opkn.jobs
                                  SET title = $1, 
                                  description = $2,
                                  company_id = $3,
                                  location_id = $4,
                                  deadline = $5,
                                  position_id = $7,
                                  status = $8
                                  WHERE id = $6
                                  `;
            const values = [data.title, data.description, data.company_id, data.location_id, data.deadline, jobId, data.position_id, status];
            const result = await client.query(query, values);

            res.redirect(`/contest/individual-job-posting/${jobId}`);
        } catch (queryError) {
            res.status(500).send("Error during adding skill " + queryError);
        } finally {
            client.release();
        }
    } catch (connectionError) {
        res.status(500).send("Error connecting to the database: " + connectionError);
    }
});

/*DELETE job posting */
router.delete('/delete-job-posting/:id/:adminId', async (req, res) => {
    const jobId = req.params.id;
    const client = await req.pool.connect();
    const adminId = req.params.adminId;
    console.log("jobId", jobId)
    try {
        await client.query(`DELETE FROM opkn.jobs WHERE id = $1`, [jobId]);
        console.log("uslo ovdjeeee")
        res.json({ success: true, redirectUrl: `/contest/my-job-postings/${adminId}` });
    } catch (err) {
        console.error('Error while deleting job posting:', err);
        res.status(500).json({ success: false, error: 'Failed to delete job posting' });
    } finally {
        client.release();
    }
});

router.get('/generatePDF/:jobId', async (req, res, next )=>{
   const jobId = req.params.jobId;

   await req.pool.connect(async (error, client, done) => {
       if(error)
           return res.status(500).json({error: "Error while trying to connect on database" + error});
       client.query(`SELECT j.*,
                     c.name as company_name,
                     s.name as status_name,
                     u.name as admin_name,
                     u.surname as admin_surname,
                     u.email as admin_email,
                     l.name as location_name,
                     p.name as position_name
                     FROM opkn.jobs j
                     LEFT JOIN opkn.companies c ON c.id = j.company_id
                     LEFT JOIN opkn.job_status s ON s.id = j.status
                     LEFT JOIN opkn.users u ON u.id = j.admin_id
                     LEFT JOIN opkn.locations l ON l.id = j.location_id
                     LEFT JOIN opkn.positions p ON p.id = j.position_id
                     WHERE j.id = $1`,[jobId], async (err, result) => {
           done();
           if(err)
               return res.status(500).json({error: "Error while fetching data (job data) " + err})
           client.query(`SELECT a.*,
                         ass.name as application_status,
                         u.name as user_name,
                         u.surname as user_surname,
                         u.email as user_email,
                         u.phone as user_phone,
                         r.experience,
                         r.education,
                         r.technical_skills,
                         r.soft_skills,
                         r.motivation,
                         r.testing,
                         r.comment,
                         (r.experience + r.education + r.technical_skills + r.soft_skills + r.motivation + r.testing) / 6 as average_score,
                         (SELECT AVG(rating) as average_rating FROM opkn.interviews WHERE user_id = a.user_id)
                         FROM opkn.applications a
                         LEFT JOIN opkn.application_status ass ON ass.id = a.status_id
                         LEFT JOIN opkn.reviews r ON r.application_id = a.id
                         LEFT JOIN opkn.users u ON u.id = a.user_id
                         WHERE a.job_id = $1`,[jobId], async (err2, result2) => {
               if(err2)
                   return res.status(500).json({error: "Error while fetching data (user data) " + err2})
               await client.query(`SELECT r.*,
                                   a.id as application_id,
                                   u.id as user_id,
                                   u.name as user_name,
                                   u.surname as user_surname,
                                   (r.experience + r.education + r.technical_skills + r.soft_skills + r.motivation + r.testing) / 6 as average_score
                                   FROM opkn.applications a
                                   LEFT JOIN opkn.users u ON u.id = a.user_id
                                   LEFT JOIN opkn.reviews r on r.application_id = a.id       
                                   WHERE a.job_id = $1
                                   ORDER BY average_score DESC`,[jobId], async (err3, result3) => {
                   if(err3)
                       return res.status(500).json({error: "Error while trying to fetch data (ratings and reviews) " + err3})

        const job_info = result.rows[0];
        const user_info = result2.rows;
        const final_ranking = result3.rows;
        console.log("JOB INFO", job_info);
        console.log("USER INFO ",user_info);
        console.log("FINAL RANKING", final_ranking);
        const pdfFile = generateReport(job_info, user_info, final_ranking, (err, fileName) => {
            if (err) {
                console.error('Error while generating PDF:', err);
                return res.status(500).json({ error: 'Failed to generate the PDF.' });
            }
            res.download(fileName, (err) => {
                if (err) {
                    console.error('Error while sending the file:', err);
                    res.status(500).json({ error: 'Failed to send the file.' });
                } else {
                    console.log('File successfully sent to client.');
                }
                // Opcionalno brisanje fajla nakon slanja
                fs.unlink(fileName, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting temporary file:', unlinkErr);
                    else console.log('Temporary file deleted.');
                });
            });
        });
       });
       });
       });
   })
});

module.exports = router;
