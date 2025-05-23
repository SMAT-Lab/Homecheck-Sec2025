// Code Sample with Security Issue 1
import express from 'express';
const app = express();

app.use(express.urlencoded({ extended: true }));

let userData = { email: 'user@example.com' };

app.post('/update-email', (req, res) => {
    userData.email = req.body.email;
    res.send('Email updated to ' + userData.email);
});

app.listen(3000);
