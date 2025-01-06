var express = require('express');
var router = express.Router();

/* GET individual job posting */
router.get("/:id", async function(req,res,next){
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

module.exports = router;
