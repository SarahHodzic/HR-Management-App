var express = require('express');
var router = express.Router();

router.get('/chat-history/:receiver_id/:sender_id', async (req, res) => {
    const {receiver_id, sender_id} = req.params;
    try {
        const client = await req.pool.connect();
        const result = await client.query(
            'SELECT * FROM opkn.chat WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp ASC',
            [sender_id, receiver_id]
        );
        client.release();
        return res.json(result.rows);
    } catch (error) {
        console.error("Error fetching chat history: ", error);
        return [];
    }
});

/* GET home page. */
router.get('/:id', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const userId = parseInt(req.params.id);

    if(userId === user.id) {
        await req.pool.connect(async (error, client, done) => {
            if (error)
                return res.status(500).json({error: "Error while trying to connect to database " + error})
            await client.query("SELECT * FROM opkn.users WHERE id = $1", [req.session.userId], async (err, result) => {
                done();
                if (err)
                    return res.status(500).json({error: "Error while trying to fetch data " + err})
                await client.query(`SELECT DISTINCT 
                                u.id, u.name, u.surname 
                                FROM opkn.chat c
                                JOIN opkn.users u ON u.id = CASE
                                WHEN c.sender_id = $1 THEN c.receiver_id
                                ELSE c.sender_id
                                END
                                WHERE c.sender_id = $1 OR c.receiver_id = $1`, [userId], async (err1, result1) => {

                    if (err1)
                        return res.status(500).json({error: "Error while trying to fetch chat users " + err1})
                    const user_info = result.rows[0];
                    const chat_user = result1.rows;
                    const new_chat = {
                        id: -100,
                        name: "test",
                        surname: "test"
                    }

                    res.render('chat', {
                        title: 'Chat | HRWorks',
                        user: user,
                        user_info: user_info,
                        exists: true,
                        chat_list: chat_user,
                        new_chat: new_chat,
                    });
                });
            });
        });
    }
    else{
        res.redirect(`/chat/${user.id}`)
    }
});

/* GET home page. */
router.get('/admin/:adminId/:userId', async function (req, res, next) {
    const user = {
        id: req.session.userId,
        role: req.session.userRole,
        name: req.session.name,
        surname: req.session.surname
    }
    const adminId = parseInt(req.params.adminId);
    const userId = req.params.userId;

    if(user.role === 1 && adminId === user.id) {
        await req.pool.connect(async (error, client, done) => {
            if (error)
                return res.status(500).json({error: "Error while trying to connect to database " + error})
            await client.query("SELECT * FROM opkn.users WHERE id = $1", [req.session.userId], async (err, result) => {
                done();
                if (err)
                    return res.status(500).json({error: "Error while trying to fetch data " + err})
                await client.query(`SELECT DISTINCT 
                                u.id, u.name, u.surname 
                                FROM opkn.chat c
                                JOIN opkn.users u ON u.id = CASE
                                WHEN c.sender_id = $1 THEN c.receiver_id
                                ELSE c.sender_id
                                END
                                WHERE c.sender_id = $1 OR c.receiver_id = $1`, [adminId], async (err1, result1) => {

                    if (err1)
                        return res.status(500).json({error: "Error while trying to fetch chat users " + err1})
                    await client.query(`SELECT  
                                u.id, u.name, u.surname 
                                FROM opkn.users u
                                WHERE u.id = $1`, [userId], async (err2, result2) => {

                        if (err2)
                            return res.status(500).json({error: "Error while trying to fetch chat users " + err2})


                        const chat_user = result1.rows;
                        const user_info = result.rows[0];
                        const new_chat = result2.rows[0];

                        console.log('CHAT USER' , chat_user)

                        const userExists = chat_user.some(user => user.id === parseInt(userId));
                        if (userExists) {
                            console.log(`User with ID ${userId} exists in a list.`);
                        } else {
                            console.log(`User with ID ${userId} exists in a list.`);
                        }

                        res.render('chat', {
                            title: 'Chat | HRWorks',
                            user: user,
                            user_info: user_info,
                            chat_list: chat_user,
                            new_chat: new_chat,
                            exists: userExists,
                        });
                    });
                });
            });
        });
    }
    else if(user.role !== 1){
        res.redirect(`/chat/${user.id}`);
    }
    else {
        res.redirect(`/chat/admin/${user.id}/${userId}`);
    }
});

module.exports = router;
