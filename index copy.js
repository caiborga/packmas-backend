const express = require('express');
const { Database } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const backendPort = 3000;
const frontendPort = 4200;

var dataBase

const loginDB = new sqlite3.Database('loginDB.db');
loginDB.run('CREATE TABLE IF NOT EXISTS login (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, key TEXT)');

app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + frontendPort);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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

function dataBaseValid(req, callback) {
    var key = req.headers.authorization
    
    loginDB.get('SELECT name FROM login WHERE key = ?', [key], (err, row) => {
        if (err || !row) {
            console.log("error", err);
            callback(false);
        } else {
            setDatabase(key);
            callback(true);
        }
    });
}

function setDatabase(key) {
    console.log("key", key)
    dataBase = new sqlite3.Database('db/' + key + '.db');
    console.log("dataBase", dataBase)
}

function generateDatabase(key) {
    const db = new sqlite3.Database('db/' + key + '.db');
    db.run('CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, avatar TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS things (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, perPerson FLOAT, unitID FLOAT, weight FLOAT)');
    db.run('CREATE TABLE IF NOT EXISTS tours (id INTEGER PRIMARY KEY AUTOINCREMENT, tourData TEXT, tourParticipants TEXT, tourThings TEXT, tourCars TEXT)');
}

// GROUP

app.post('/api/register', (req, res) => {
    const { name } = req.body;
    console.log("req.body", name)
    const key = generateKey()
    generateDatabase(key)

    loginDB.run('INSERT INTO login (name, key) VALUES (?, ?)', [name, key], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Group added successfully', key: key });
    });
});

app.get('/api/group/:key', (req, res) => {
    const key = req.params.key;

    loginDB.get('SELECT name FROM login WHERE key = ?', [key], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ message: 'Key not found', existing: false });
            return;
        }
        res.json({ message: 'Key found', name: row.name, existing: true });
    });
});

// PARTICIPANTS

app.post('/api/participants', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const { name, avatar } = req.body;
        dataBase.run('INSERT INTO participants (name, avatar) VALUES (?, ?)', [name, avatar], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(200).json({ message: 'Participant added successfully' });
        });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.get('/api/participants', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            dataBase.all('SELECT * FROM participants', (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ participants: rows });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/participants/:id', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const userId = req.params.id;
            const { name, avatar } = req.body;

            dataBase.run('UPDATE participants SET name = ?, avatar = ? WHERE id = ?',
                [name, avatar, userId],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    res.json({ message: 'User updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.delete('/api/participants/:id', (req, res) => {

    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const userId = req.params.id;

            dataBase.run('DELETE FROM participants WHERE id = ?', userId, function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message: 'User deleted successfully' });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

// THINGS

app.get('/api/things', (req, res) => {

    dataBaseValid(req, function(isValid) {
        if (isValid) {
            dataBase.all('SELECT * FROM things', (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ things: rows });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.post('/api/things', (req, res) => {

    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const { name, category, perPerson, unitID, weight } = req.body;
            dataBase.run('INSERT INTO things (name, category, perPerson, unitID, weight) VALUES (?, ?, ?, ?, ?)', [name, category, perPerson, unitID, weight], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Thing added successfully' });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/things/:id', (req, res) => {

    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const thingID = req.params.id;
            const { name, category, perPerson, unitID, weight } = req.body;

            dataBase.run(
                'UPDATE things SET name = ?, category = ?, perPerson = ?, unitID = ?, weight = ? WHERE id = ?',
                [name, category, perPerson, unitID, weight, thingID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Thing updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.delete('/api/things/:id', (req, res) => {
    
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const userId = req.params.id;
            dataBase.run('DELETE FROM things WHERE id = ?', userId, function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message: 'Thing deleted successfully' });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

// TOURS

app.post('/api/tours', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const { tourData, tourParticipants, tourThings, tourCars } = req.body;
            dataBase.run('INSERT INTO tours (tourData, tourParticipants, tourThings, tourCars) VALUES (?, ?, ?, ?)', [tourData, tourParticipants, tourThings, tourCars], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Tour added successfully' });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.get('/api/tour/:id', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourId = req.params.id;
            dataBase.get('SELECT * FROM tours WHERE id = ?', [tourId], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                if (!row) {
                    res.status(404).json({ error: 'Tour not found' });
                    return;
                }
                res.json({ tour: row });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.get('/api/tours', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            dataBase.all('SELECT * FROM tours', (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ tours: rows });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/tour/:id', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourID = req.params.id;
            const { tourData, tourParticipants, tourThings, tourCars } = req.body;

            dataBase.run(
                'UPDATE tours SET tourData = ?, tourParticipants = ?, tourThings = ?, tourCars = ? WHERE id = ?',
                [tourData, tourParticipants, tourThings, tourCars, tourID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Tour updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
    
});

app.put('/api/tour/:id/cars', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourID = req.params.id;
            const { tourCars } = req.body;

            dataBase.run(
                'UPDATE tours SET tourCars = ? WHERE id = ?',
                [tourCars, tourID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Tour Cars updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/tour/:id/data', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourID = req.params.id;
            const { tourData } = req.body;

            dataBase.run(
                'UPDATE tours SET tourData = ? WHERE id = ?',
                [tourData, tourID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Tour Data updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/tour/:id/participants', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourID = req.params.id;
            const { tourParticipants } = req.body;

            dataBase.run(
                'UPDATE tours SET tourParticipants = ? WHERE id = ?',
                [tourParticipants, tourID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Tour Participants updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});

app.put('/api/tour/:id/things', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const tourID = req.params.id;
            const { tourThings } = req.body;

            dataBase.run(
                'UPDATE tours SET tourThings = ? WHERE id = ?',
                [tourThings, tourID],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: 'Tour Things updated successfully' });
                }
            );
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
    
});

app.delete('/api/tours/:id', (req, res) => {
    dataBaseValid(req, function(isValid) {
        if (isValid) {
            const userId = req.params.id;

            dataBase.run('DELETE FROM tours WHERE id = ?', userId, function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({ message: 'Tour deleted successfully' });
            });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    });
});


app.listen(backendPort, () => {
    console.log(`Server is running on port ${backendPort}`);
});
