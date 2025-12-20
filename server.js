require('dotenv').config();
const mongo = require('mongodb')
const express = require('express');
const mongoose = require('mongoose'); 
const app = express();
const URI = process.env.MONGODB_URI

mongoose.connect(URI)
const database = mongoose.connection

database.on('error', (err) => {
    console.log(err)
})

database.once('connected', () => {
    console.log('Database connected');
});

app.use(express.json())

app.get('/calcprice' , async (req, res) => {
    try {
        let {date, location_id, room_id} = req.query;
        try {
            date = date[0];
            location_id = location_id[0];
            room_id = room_id[0];
        }
        catch (error) {
            console.error('Error parsing query parameters:', error);
            return res.status(400).json({ error: 'Invalid query parameters' });
        }
        if (!date || !location_id) {
            return res.status(400).json({ error: 'Missing required query parameters: date or location_id' });
        }
        const tempReq = await fetch('http://weatherservice:8080/?location_id=' + location_id + '&date=' + date);
        const tempData = await tempReq.json();
        const roomReq = await fetch('http://roomservice:8081/price?id=' + room_id);
        const roomData = await roomReq.json();
        let finalPrice;
        let tempOffset = tempData.temp - 21;
        if (tempOffset < 0) {
            tempOffset = tempOffset * -1;
        }
        if (tempOffset <= 2) {
            finalPrice = roomData.price;
        }
        else if (tempData.temp < 5) {
            finalPrice = (roomData.basePrice * 1.1).toFixed(2);
        }
        else if (tempData.temp < 10) {
            finalPrice = (roomData.basePrice * 1.2).toFixed(2);
        }
        else if (tempData.temp < 20) {
            finalPrice = (roomData.basePrice * 1.3).toFixed(2);
        }
        else {
            finalPrice = (roomData.basePrice * 1.5).toFixed(2);
        }
        return res.json({adjustedPrice: finalPrice});
    }
    catch (error) {
        console.error('Error calculating price:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/checkbooking', async (req, res) => {
    try {
        const {date, room_id} = req.query;
        if (!date || !room_id) {
            return res.status(400).json({ error: 'Missing required query parameters: date or room_id' });
        }
        const booking = await database.collection('bookingData').findOne({date: String(date), room_id: String(room_id)});
        if (booking != null) {
            return res.json({available: false});
        }
        else {
            return res.json({available: true});
        }
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/makebooking', async (req, res) => {
    try {
        const {date, room_id} = req.query;
        const user_id = req.query.user_id || req.headers["x-user-id"];
        try {
            date = date[0];
            user_id = user_id[0];
            room_id = room_id[0];
        }
        catch (error) {
            console.error('Error parsing query parameters:', error);
            return res.status(400).json({ error: 'Invalid query parameters' });
        }
        if (!date || !room_id || !user_id) {
            return res.status(400).json({ error: 'Missing required query parameters: date, room_id or user_id' });
        }
        const newBooking = {
            user_id: String(user_id),
            room_id: String(room_id),
            date: String(date)            
        };
        console.log("Booking created" + user_id + " " + room_id + " " + date);
        await database.collection('bookingData').insertOne(newBooking);
        return res.json({ message: 'Booking created successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/getrooms', async (req, res) => {
    try {
        const roomsResp = await fetch('http://roomservice:8081/rooms');
        const roomsData = await roomsResp.json();
        return res.json(roomsData);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

app.listen(process.env.PORT, (req, res) => {
    console.log(`Server is listening on port ${process.env.PORT}`);
});