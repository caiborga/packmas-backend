const express = require('express');
const { Client } = require('pg');

const app = express();
const backendPort = 3400;
const frontendPort = 4200;
const port = process.env.PORT || backendPort;

// const client = new Client({
//     user: 'postgres',
//     host: 'localhost',
//     database: 'packmas_db',
//     password: 'postgresql4Crap!',
//     port: 3300,
// });

// HEROKU DB
const client = new Client({
    user: 'whvuennigfhsfj',
    host: 'ec2-52-51-248-250.eu-west-1.compute.amazonaws.com',
    database: 'da65frsefubl36',
    password: '93efbf1c80ff756030f418b429ebd60bd1ea504d9589a3fe116b1246fc1f366b',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect();

client.query(`
        CREATE TABLE IF NOT EXISTS login (
            id SERIAL PRIMARY KEY,
            name TEXT,
            key TEXT
        )
 `);

app.use(express.json());
// app.use((req, res, next) => {
//     res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + frontendPort);
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//     res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
//     next();
// });

// app.use((req, res, next) => {
//     res.setHeader('Access-Control-Allow-Origin', 'https://caiborga.github.io/mtc-frontend/browser/');
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//     res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
//     next();
// });

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://caiborga.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Erlaubte Methoden
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Erlaubte Header
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

function generateKey() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 10;
    let key = '';
    for (let i = 0; i < length; i++) {
        key += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return key;
}

async function generateDatabase(key) {
    try {

        // Erstelle ein neues Schema für die Gruppe
        await client.query(`CREATE SCHEMA IF NOT EXISTS group_${key}`);

        // Erstelle die Tabellen im Schema der Gruppe
        await client.query(`
            CREATE TABLE IF NOT EXISTS group_${key}.participants (
                id SERIAL PRIMARY KEY,
                name TEXT,
                avatar TEXT
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS group_${key}.things (
                id SERIAL PRIMARY KEY,
                name TEXT,
                category TEXT,
                per_person FLOAT,
                unit_id FLOAT,
                weight FLOAT
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS group_${key}.tours (
                id SERIAL PRIMARY KEY,
                tour_data TEXT,
                tour_participants TEXT,
                tour_things TEXT,
                tour_cars TEXT
            )
        `);

        console.log(`Database for group with key ${key} created successfully.`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

async function getSchema(req) {
    const key = req.headers.authorization;
    if (!key) {
        throw new Error('Authorization header is missing');
    }

    try {
        const result = await client.query('SELECT key FROM login WHERE key = $1', [key]);
        
        if (result.rows.length === 0) {
            throw new Error('Key not found');
        } else {
            return `group_${key}`;
        }
    } catch (err) {
        throw new Error(`Error: ${err.message}`);
    }
}

// GROUP

app.post('/api/register', async (req, res) => {
    const { name } = req.body;
    const key = generateKey();
    await generateDatabase(key);

    try {
        await client.query('INSERT INTO login (name, key) VALUES ($1, $2)', [name, key]);
        res.json({ message: 'Group added successfully', key: key });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/group/:key', async (req, res) => {
    const key = req.params.key;

    try {
        const result = await client.query('SELECT name FROM login WHERE key = $1', [key]);
        
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Key not found', existing: false });
        } else {
            res.json({ message: 'Key found', name: result.rows[0].name, existing: true });
        }
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// PARTICIPANTS

app.post('/api/participants', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { name, avatar } = req.body;

        // Führe die INSERT-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`INSERT INTO ${schema}.participants (name, avatar) VALUES ($1, $2)`, [name, avatar]);
        
        res.status(200).json({ message: 'Participant added successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/participants', async (req, res) => {
    try {
        const schema = await getSchema(req);
        
        // Abfrage, um alle Werte aus der Tabelle participants im ermittelten Schema zu erhalten
        const result = await client.query(`SELECT * FROM ${schema}.participants`);
        res.json({ participants: result.rows });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/participants/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const userId = req.params.id;
        const { name, avatar } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`UPDATE ${schema}.participants SET name = $1, avatar = $2 WHERE id = $3`, [name, avatar, userId]);
        
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/participants/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const userId = req.params.id;

        // Führe die DELETE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`DELETE FROM ${schema}.participants WHERE id = $1`, [userId]);
        
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// THINGS

app.post('/api/things', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { name, category, perPerson, unit, weight } = req.body;

        // Führe die INSERT-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`INSERT INTO ${schema}.things (name, category, per_person, unit_id, weight) VALUES ($1, $2, $3, $4, $5)`, [name, category, perPerson, unit, weight]);
        
        res.json({ message: 'Thing added successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/things', async (req, res) => {
    try {
        const schema = await getSchema(req);
        
        // Führe die SELECT-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        const result = await client.query(`SELECT * FROM ${schema}.things`);
        
        res.json({ things: result.rows });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/things/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const thingID = req.params.id;
        const { name, category, perPerson, unit, weight } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(
            `UPDATE ${schema}.things SET name = $1, category = $2, per_person = $3, unit_id = $4, weight = $5 WHERE id = $6`,
            [name, category, perPerson, unit, weight, thingID]
        );
        
        res.json({ message: 'Thing updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/things/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const thingID = req.params.id;

        // Führe die DELETE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`DELETE FROM ${schema}.things WHERE id = $1`, [thingID]);
        
        res.json({ message: 'Thing deleted successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// TOURS

app.post('/api/tours', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { tourData, tourParticipants, tourThings, tourCars } = req.body;

        await client.query(`INSERT INTO ${schema}.tours (tour_data, tour_participants, tour_things, tour_cars) VALUES ($1, $2, $3, $4)`, [tourData, tourParticipants, tourThings, tourCars]);
        
        res.json({ message: 'Tour added successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/tour/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourId = req.params.id;
        const result = await client.query(`SELECT * FROM ${schema}.tours WHERE id = $1`, [tourId]);
        
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Tour not found' });
        } else {
            res.json({ tour: result.rows[0] });
        }
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/tours', async (req, res) => {
    try {
        const schema = await getSchema(req);
        
        // Führe die SELECT-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        const result = await client.query(`SELECT * FROM ${schema}.tours`);
        
        res.json({ tours: result.rows });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/tour/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourData, tourParticipants, tourThings, tourCars } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(
            `UPDATE ${schema}.tours SET tour_data = $1, tour_participants = $2, tour_things = $3, tour_cars = $4 WHERE id = $5`,
            [tourData, tourParticipants, tourThings, tourCars, tourID]
        );
        
        res.json({ message: 'Tour updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/tour/:id/cars', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourCars } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(
            `UPDATE ${schema}.tours SET tour_cars = $1 WHERE id = $2`,
            [tourCars, tourID]
        );
        
        res.json({ message: 'Tour Cars updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/tour/:id/data', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourData } = req.body;

        await client.query(
            `UPDATE ${schema}.tours SET tour_data = $1 WHERE id = $2`,
            [tourData, tourID]
        );
        
        res.json({ message: 'Tour Data updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/tour/:id/participants', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourParticipants } = req.body;

        await client.query(
            `UPDATE ${schema}.tours SET tour_participants = $1 WHERE id = $2`,
            [tourParticipants, tourID]
        );
        
        res.json({ message: 'Tour Participants updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/tour/:id/things', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourThings } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(
            `UPDATE ${schema}.tours SET tour_things = $1 WHERE id = $2`,
            [tourThings, tourID]
        );
        
        res.json({ message: 'Tour Things updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/tours/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;

        // Führe die DELETE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(`DELETE FROM ${schema}.tours WHERE id = $1`, [tourID]);
        
        res.json({ message: 'Tour deleted successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// SERVER IS RUNNING

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});