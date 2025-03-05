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

const settingsTables = [
    { 
        table: 'CAR_BRANDS',
        elements: ['Audi', 'Opel', 'Maserati', 'VW']
    },
    {
        table: 'CAR_VARIANTS',
        elements: ['Limousine', 'SUV', 'Pickup', 'Van']
    },
    {
        table: 'GENERAL_VIEW',
        elements: []
    },
    {
        table: 'THING_UNITS',
        elements: ['kg', 'Dose', 'Bund', 'Glas']
    },
    {
        table: 'THING_CATEGORIES',
        elements: ['Verbrauchsgegenstände', 'Nahrungsmittel', 'Sonstige']
    }
]

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

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://packmas-c545d34ac462.herokuapp.com/');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
});

// app.use((req, res, next) => {
//     res.setHeader('Access-Control-Allow-Origin', 'https://caiborga.github.io');
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Erlaubte Methoden
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Erlaubte Header
//     if (req.method === 'OPTIONS') {
//         return res.sendStatus(200);
//     }
//     next();
// });

function generateKey() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 10;
    let key = '';
    for (let i = 0; i < length; i++) {
        key += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return key;
}

async function generateSettingsTables(key) {
    try {
        for (const setting of settingsTables) {
            const tableName = `group_${key}.${setting.table.toLowerCase()}`;
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id SERIAL PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);
            
            if (setting.elements.length > 0) {
                for (const element of setting.elements) {
                    await client.query(`INSERT INTO ${tableName} (value) VALUES ($1) ON CONFLICT DO NOTHING`, [element]);
                }
            }
        }
        console.log(`Settings tables for group ${key} created successfully.`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

async function generateDatabase(key) {
    try {

        // Erstelle ein neues Schema für die Gruppe
        await client.query(`CREATE SCHEMA IF NOT EXISTS group_${key}`);

        // Erstelle die Tabellen im Schema der Gruppe
        await client.query(`
            CREATE TABLE IF NOT EXISTS group_${key}.cars (
                id SERIAL PRIMARY KEY,
                brand FLOAT,
                name TEXT,
                driver FLOAT,
                passengers TEXT, 
                seats FLOAT,
                color TEXT,
                model TEXT
            )
        `);

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
                tour_members TEXT,
                tour_things TEXT,
                tour_cars TEXT,
                tour_assignments TEXT
            )
        `);

        await generateSettingsTables(key);

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

        const result = await client.query(
            `INSERT INTO ${schema}.participants (name, avatar) VALUES ($1, $2) RETURNING id`,
            [name, avatar]
        );

        const newParticipantId = result.rows[0].id;

        res.status(200).json({ message: 'Participant added successfully', id: newParticipantId });
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

        // Params
        const page = parseInt(req.query.page) || 1;
        const filter = req.query.filter || '';
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parameterisierte Abfrage zur Vermeidung von SQL-Injections
        const query = `
            SELECT * 
            FROM ${schema}.participants
            WHERE name ILIKE $1
            LIMIT $2 OFFSET $3
        `;

        // Abfrage für die Gesamtzahl der Teilnehmer
        const countQuery = `
            SELECT COUNT(*) 
            FROM ${schema}.participants
            WHERE name ILIKE $1
        `;
        
        const countResult = await client.query(countQuery, [`%${filter}%`]);
        const totalParticipants = parseInt(countResult.rows[0].count);

        // Den Suchbegriff anpassen (für Teilübereinstimmungen)
        const values = [`%${filter}%`, limit, offset];

        // Query ausführen
        const result = await client.query(query, values);
        res.json({
            participants: result.rows,
            pagination: {
                total: totalParticipants,
                page: page,
                limit: limit,
                offset: offset
            }
        });
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

// CARS

app.post('/api/cars', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { name, driver, passengers, seats, model, brand, color } = req.body;

        const result = await client.query(
            `INSERT INTO ${schema}.cars (name, driver, passengers, seats, model, brand, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [name, driver, passengers, seats, model, brand, color]
        );

        const newCarId = result.rows[0].id;

        res.status(200).json({ message: 'Car added successfully', id: newCarId });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/cars', async (req, res) => {
    try {
        const schema = await getSchema(req);

        // Params
        const page = parseInt(req.query.page) || 1;
        const filter = req.query.filter || '';
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Parameterisierte Abfrage zur Vermeidung von SQL-Injections
        const query = `
            SELECT * 
            FROM ${schema}.cars
            WHERE name ILIKE $1
            LIMIT $2 OFFSET $3
        `;

        // Abfrage für die Gesamtzahl der Autos
        const countQuery = `
            SELECT COUNT(*) 
            FROM ${schema}.cars
            WHERE name ILIKE $1
        `;
        const countResult = await client.query(countQuery, [`%${filter}%`]);
        const totalParticipants = parseInt(countResult.rows[0].count);

        // Den Suchbegriff anpassen (für Teilübereinstimmungen)
        const values = [`%${filter}%`, limit, offset];

        // Query ausführen
        const result = await client.query(query, values);

        // Helper-Funktion: Zusatzdaten abrufen und in ID-basiertes Mapping umwandeln
        const fetchAdditionalData = async (table, ids) => {
            if (!ids || ids.length === 0) return {};
            
            const query = `
                SELECT * 
                FROM ${schema}.${table} 
                WHERE id = ANY($1::int[])
            `;
            const result = await client.query(query, [ids]);
            
            const dataById = {};
            for (const row of result.rows) {
                dataById[row.id] = row;
            }
            return dataById;
        };

        // IDs aus den Tour-Daten extrahieren
        const brandIds = [...new Set(result.rows.map(item => item.brand).filter(brand => brand !== null))];
        const carsIds = [...new Set(result.rows.map(item => item.car).filter(car => car !== null))];
        const driverIds = [...new Set(result.rows.map(item => item.driver).filter(driver => driver !== null))];

        // Zusatzdaten abrufen
        const [brands, cars, drivers] = await Promise.all([
            fetchAdditionalData('cars', carsIds),
            fetchAdditionalData('car_brands', brandIds),
            fetchAdditionalData('participants', driverIds),
        ]);

        res.json({
            cars: result.rows,
            data: {
                brands: brands,
                cars: cars,
                drivers: drivers
            },
            pagination: {
                total: totalParticipants,
                page: page,
                limit: limit,
                offset: offset
            }
        });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/cars/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const carId = req.params.id;
        const { name, driver, passengers, seats, model, brand, color } = req.body;

        await client.query(`UPDATE ${schema}.cars SET 
            name = $1, 
            driver = $2, 
            passengers = $3, 
            seats = $4,
            model = $5,
            brand = $6,
            color = $7
            WHERE id = $8`, [name, driver, passengers, seats, model, brand, color, carId]);
        
        res.json({ message: 'Car updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/cars/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const carId = req.params.id;

        await client.query(`DELETE FROM ${schema}.cars WHERE id = $1`, [carId]);
        
        res.json({ message: 'Car deleted successfully' });
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

        // Params
        const page = parseInt(req.query.page) || 1;
        const filter = req.query.filter || '';
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Parameterisierte Abfrage zur Vermeidung von SQL-Injections
        const query = `
            SELECT * 
            FROM ${schema}.things
            WHERE name ILIKE $1
            LIMIT $2 OFFSET $3
        `;

        // Abfrage für die Gesamtanzahl der Einträge
        const countQuery = `
            SELECT COUNT(*) 
            FROM ${schema}.things
            WHERE name ILIKE $1
        `;

        const countResult = await client.query(countQuery, [`%${filter}%`]);
        const totalThings = parseInt(countResult.rows[0].count);

        // Den Suchbegriff anpassen (für Teilübereinstimmungen)
        const values = [`%${filter}%`, limit, offset];

        // Query ausführen
        const result = await client.query(query, values);

        // Helper-Funktion: Zusatzdaten abrufen und in ID-basiertes Mapping umwandeln
        const fetchAdditionalData = async (table, ids) => {
            if (!ids || ids.length === 0) return {};
            
            const query = `
                SELECT * 
                FROM ${schema}.${table} 
                WHERE id = ANY($1::int[])
            `;
            const result = await client.query(query, [ids]);
            
            const dataById = {};
            for (const row of result.rows) {
                dataById[row.id] = row;
            }
            return dataById;
        };

        // IDs aus den Tour-Daten extrahieren
        const categoryIds = [...new Set(result.rows.map(item => item.category).filter(category => category !== null))];
        const unitIds = [...new Set(result.rows.map(item => item.unit_id).filter(unit_id => unit_id !== null))];

        // Zusatzdaten abrufen
        const [categories, units] = await Promise.all([
            fetchAdditionalData('thing_categories', categoryIds),
            fetchAdditionalData('thing_units', unitIds),
        ]);

        // Ergebnisse zurückgeben
        res.json({
            things: result.rows,
            data: {
                categories: categories,
                units: units
            },
            pagination: {
                total: totalThings,
                page: page,
                limit: limit,
                offset: offset
            }
        });
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
        const { tourData, tourMembers, tourThings, tourCars, tourAssignments } = req.body;

        await client.query(`INSERT INTO ${schema}.tours (tour_data, tour_members, tour_things, tour_cars, tour_assignments) VALUES ($1, $2, $3, $4, $5)`, [tourData, tourMembers, tourThings, tourCars, tourAssignments]);
        
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

        // Validierung der Tour-ID
        const tourId = parseInt(req.params.id, 10);
        if (isNaN(tourId)) {
            return res.status(400).json({ message: 'Invalid tour ID' });
        }

        // Tour-Daten aus der Datenbank abrufen
        const tourResult = await client.query(`SELECT * FROM ${schema}.tours WHERE id = $1`, [tourId]);

        if (tourResult.rows.length === 0) {
            return res.status(404).json({ message: 'Tour not found' });
        }

        const tour = tourResult.rows[0];

        // Helper-Funktion: Zusatzdaten abrufen und in ID-basiertes Mapping umwandeln
        const fetchAdditionalData = async (table, ids) => {
            if (!ids || ids.length === 0) return {};
            
            const query = `
                SELECT * 
                FROM ${schema}.${table} 
                WHERE id = ANY($1::int[])
            `;
            const result = await client.query(query, [ids]);
            
            const dataById = {};
            for (const row of result.rows) {
                dataById[row.id] = row;
            }
            return dataById;
        };

        // IDs aus den Tour-Daten extrahieren
        const tourThingsIds = JSON.parse(tour.tour_things || '[]');
        const tourMembersIds = JSON.parse(tour.tour_members || '[]');
        const tourCarsIds = JSON.parse(tour.tour_cars || '[]');

        // Zusatzdaten abrufen
        const [thingsDataById, membersDataById, carsDataById] = await Promise.all([
            fetchAdditionalData('things', tourThingsIds),
            fetchAdditionalData('participants', tourMembersIds),
            fetchAdditionalData('cars', tourCarsIds), // Tabelle für Autos
        ]);

        const totalWeight = Object.values(thingsDataById).reduce((sum, thing) => sum + (thing.weight || 0), 0);

        // Antwortobjekt erstellen
        const response = {
            id: tour.id,
            tour_data: JSON.parse(tour.tour_data || '{}'),
            tour_cars: {
                ids: tourCarsIds,
                data: carsDataById,
            },
            tour_members: {
                ids: tourMembersIds,
                data: membersDataById,
            },
            tour_things: {
                ids: tourThingsIds,
                data: thingsDataById,
                totalWeight: totalWeight,
            },
            tour_assignments: JSON.parse(tour.tour_assignments || '{}'),

        };

        res.json({ tour: response });
    } catch (err) {
        console.error("Error:", err.message);

        if (err.message === 'Authorization header is missing' || err.message === 'Key not found') {
            res.status(404).json({ message: 'Not found' });
        } else {
            res.status(500).json({ error: 'An internal server error occurred' });
        }
    }
});

app.get('/api/tours', async (req, res) => {
    try {
        const schema = await getSchema(req);

        // Alle Touren aus der Datenbank abrufen
        const toursResult = await client.query(`SELECT * FROM ${schema}.tours`);
        const tours = toursResult.rows;

        if (tours.length === 0) {
            return res.json({ tours: [] });
        }

        // IDs aus allen Touren extrahieren
        const allTourThingsIds = [];
        const allTourMembersIds = [];
        const allTourCarsIds = [];

        for (const tour of tours) {
            allTourThingsIds.push(...JSON.parse(tour.tour_things || '[]'));
            allTourMembersIds.push(...JSON.parse(tour.tour_members || '[]'));
            allTourCarsIds.push(...JSON.parse(tour.tour_cars || '[]'));
        }

        // Helper-Funktion: Duplikate entfernen
        const unique = (arr) => [...new Set(arr)];

        const uniqueThingsIds = unique(allTourThingsIds);
        const uniqueMembersIds = unique(allTourMembersIds);
        const uniqueCarsIds = unique(allTourCarsIds);

        // Zusatzdaten für alle IDs parallel abrufen
        const fetchAdditionalData = async (table, ids) => {
            if (ids.length === 0) return {};
            const query = `
                SELECT * 
                FROM ${schema}.${table} 
                WHERE id = ANY($1::int[])
            `;
            const result = await client.query(query, [ids]);
            const dataById = {};
            for (const row of result.rows) {
                dataById[row.id] = row;
            }
            return dataById;
        };

        const [thingsDataById, membersDataById, carsDataById] = await Promise.all([
            fetchAdditionalData('things', uniqueThingsIds),
            fetchAdditionalData('participants', uniqueMembersIds),
            fetchAdditionalData('cars', uniqueCarsIds),
        ]);

        // API-Antwort für alle Touren erstellen
        const toursResponse = tours.map((tour) => {
            const tourThingsIds = JSON.parse(tour.tour_things || '[]');
            const tourMembersIds = JSON.parse(tour.tour_members || '[]');
            const tourCarsIds = JSON.parse(tour.tour_cars || '[]');

            const totalWeight = tourThingsIds.reduce((sum, id) => sum + (thingsDataById[id]?.weight || 0), 0);

            return {
                id: tour.id,
                tour_data: JSON.parse(tour.tour_data || '{}'),
                tour_cars: {
                    ids: tourCarsIds,
                    data: carsDataById,
                },
                tour_members: {
                    ids: tourMembersIds,
                    data: membersDataById,
                },
                tour_things: {
                    ids: tourThingsIds,
                    data: thingsDataById,
                    totalWeight: totalWeight,
                }
            };
        });

        res.json({ tours: toursResponse });
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
            `UPDATE ${schema}.tours SET tour_data = $1, tour_members = $2, tour_things = $3, tour_cars = $4 WHERE id = $5`,
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
        const { tourMembers } = req.body;

        console.log('tourParticipants', tourMembers)

        await client.query(
            `UPDATE ${schema}.tours SET tour_members = $1 WHERE id = $2`,
            [tourMembers, tourID]
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

app.put('/api/tour/:id/assignments', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const tourID = req.params.id;
        const { tourAssignments } = req.body;

        // Führe die UPDATE-Abfrage in der entsprechenden Tabelle des ermittelten Schemas aus
        await client.query(
            `UPDATE ${schema}.tours SET tour_assignments = $1 WHERE id = $2`,
            [tourAssignments, tourID]
        );

        res.json({ message: 'Tour Assignments updated successfully' });
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

// SETTINGS

app.get('/api/settings/:table', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { table } = req.params;
        
        // Allow only specific tables
        const allowedTables = settingsTables.map(setting => setting.table);
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }

        const result = await client.query(`SELECT * FROM ${schema}.${table.toLowerCase()}`);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        res.json({ table: table, data: result.rows });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


// app.get('/api/settings/:table', async (req, res) => {
//     try {
//         const schema = await getSchema(req);
//         const { table } = req.params;
        
//         const result = await client.query(`SELECT * FROM ${schema}.${table.toLowerCase()}`);
        
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'No data found' });
//         }
        
//         const dataWithTableName = result.rows.map(row => ({ ...row, table: table }));
        
//         res.json({ table: table, data: dataWithTableName });
//     } catch (err) {
//         console.error("Error:", err.message);
//         if (err.message === 'Missing key parameter') {
//             res.status(400).json({ message: 'Missing key parameter' });
//         } else {
//             res.status(500).json({ error: 'An internal server error occurred' });
//         }
//     }
// });

app.post('/api/settings/:table', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { table } = req.params;
        const { value } = req.body;
        
        if (!value) {
            return res.status(400).json({ message: 'Value is required' });
        }
        
        await client.query(`INSERT INTO ${schema}.${table.toLowerCase()} (value) VALUES ($1)`, [value]);
        res.status(201).json({ message: 'Value added successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings/:table/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { table, id } = req.params;
        const { value } = req.body;
        
        if (!value) {
            return res.status(400).json({ message: 'Value is required' });
        }
        
        await client.query(`UPDATE ${schema}.${table.toLowerCase()} SET value = $1 WHERE id = $2`, [value, id]);
        res.json({ message: 'Value updated successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/settings/:table/:id', async (req, res) => {
    try {
        const schema = await getSchema(req);
        const { table, id } = req.params;
        
        await client.query(`DELETE FROM ${schema}.${table.toLowerCase()} WHERE id = $1`, [id]);
        res.json({ message: 'Value deleted successfully' });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// SERVER IS RUNNING

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});