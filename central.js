// based on the example on https://www.npmjs.com/package/@abandonware/noble

const noble = require('@abandonware/noble');

const uuid_service = "a00693f9-f9ed-4fcc-8f89-e9b05dd65746"
const uuid_value1 = "2102"
const uuid_value2 = "2103"
const uuid_value3 = "2104"
const uuid_value4 = "2105"

let sensorValue1 = NaN              // value for uuid_value1
let sensorValue2 = NaN              // value for uuid_value2
let sensorValue3 = NaN              // value for uuid_value1 in service2
let sensorValue4 = NaN              // value for uuid_value2 in service2

const TARGET_PERIPHERAL_COUNT = 2;
const connectedPeripherals = new Map(); // track by peripheral.id

noble.on('stateChange', async (state) => {
    if (state === 'poweredOn') {
        console.log("Start scanning...");
        await noble.startScanningAsync([uuid_service], true); // true = allow duplicates
    }
});

noble.on('discover', async (peripheral) => {
    // Skip if already connected or connecting to this peripheral
    if (connectedPeripherals.has(peripheral.id)) return;

    console.log(`Discovered peripheral: ${peripheral.id} (${peripheral.advertisement.localName})`);
    connectedPeripherals.set(peripheral.id, peripheral);

    // Stop scanning only once we have enough peripherals
    if (connectedPeripherals.size >= TARGET_PERIPHERAL_COUNT) {
        console.log("Found both peripherals, stopping scan.");
        await noble.stopScanningAsync();
    }

    try {
        await peripheral.connectAsync();
        console.log(`Connected to ${peripheral.id}`);

        peripheral.on('disconnect', () => {
            console.log(`Peripheral ${peripheral.id} disconnected.`);
            connectedPeripherals.delete(peripheral.id);
        });

        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [uuid_service],
            [uuid_value1, uuid_value2, uuid_value3, uuid_value4]
        );

        // Each peripheral will only have chars 1&2 OR 3&4 — handle whichever are present
        const char1 = characteristics.find(c => c.uuid === uuid_value1);
        const char2 = characteristics.find(c => c.uuid === uuid_value2);
        const char3 = characteristics.find(c => c.uuid === uuid_value3);
        const char4 = characteristics.find(c => c.uuid === uuid_value4);

        if (char1) readData1(char1);
        if (char2) readData2(char2);
        if (char3) readData3(char3);
        if (char4) readData4(char4);

    } catch (err) {
        console.error(`Failed to connect to ${peripheral.id}:`, err);
        connectedPeripherals.delete(peripheral.id);
    }
});




//
// read data periodically
//
// helper that reads a characteristic repeatedly and stores into given variable
let readData1 = async (characteristic) => {
    const value = await characteristic.readAsync();
    sensorValue1 = value.readFloatLE(0);
    console.log("sensor1", sensorValue1);
    setTimeout(() => {
        readData1(characteristic);
    }, 10);
};

let readData2 = async (characteristic) => {
    const value = await characteristic.readAsync();
    sensorValue2 = value.readFloatLE(0);
    console.log("sensor2", sensorValue2);
    setTimeout(() => {
        readData2(characteristic);
    }, 10);
};

let readData3 = async (characteristic) => {
    const value = await characteristic.readAsync();
    sensorValue3 = value.readFloatLE(0);
    console.log("sensor3", sensorValue3);
    setTimeout(() => {
        readData3(characteristic);
    }, 10);
};

let readData4 = async (characteristic) => {
    const value = await characteristic.readAsync();
    sensorValue4 = value.readFloatLE(0);
    console.log("sensor4", sensorValue4);
    setTimeout(() => {
        readData4(characteristic);
    }, 10);
};

//
// hosting a web-based front-end and respond requests with sensor data
// based on example code on https://expressjs.com/
//
const express = require('express')
const app = express()
const port = 3000

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// server-side stored player names and scores (volatile in-memory)
let playerTop = 'Top Player';
let playerBottom = 'Bottom Player';
let serverTopScore = 0;
let serverBottomScore = 0;

const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'scores.json');

function loadScores() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const obj = JSON.parse(raw);
            playerTop = obj.playerTop || playerTop;
            playerBottom = obj.playerBottom || playerBottom;
            if (typeof obj.serverTopScore === 'number') serverTopScore = obj.serverTopScore;
            if (typeof obj.serverBottomScore === 'number') serverBottomScore = obj.serverBottomScore;
        }
    } catch (err) {
        console.error('Could not load scores:', err);
    }
}

function saveScores() {
    try {
        const obj = { playerTop, playerBottom, serverTopScore, serverBottomScore };
        fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
        console.error('Could not save scores:', err);
    }
}

loadScores();

app.get('/', (req, res) => {
    // show welcome page; the game flow starts at /names
    res.render('welcome')
})

// names entry page (collect player names before playing)
app.get('/names', (req, res) => {
    res.render('names', { playerTop, playerBottom });
});

app.post('/names', (req, res) => {
    const { topName, bottomName } = req.body;
    if (topName) playerTop = topName;
    if (bottomName) playerBottom = bottomName;
    // reset server-side scores when new names are set
    serverTopScore = 0;
    serverBottomScore = 0;
    saveScores();
    res.redirect('/game');
});

// game route
app.get('/game', (req, res) => {
    res.render('index', { playerTop, playerBottom });
});

// scoreboard page
app.get('/scores', (req, res) => {
    res.render('scores', { playerTop, playerBottom, serverTopScore, serverBottomScore });
});

// endpoint for the client to POST score updates
app.post('/update-score', (req, res) => {
    const { topScore, bottomScore } = req.body || {};
    if (typeof topScore === 'number') serverTopScore = topScore;
    if (typeof bottomScore === 'number') serverBottomScore = bottomScore;
    saveScores();
    res.json({ ok: true });
});

// ensure scores are saved on shutdown
process.on('SIGINT', () => {
    saveScores();
    process.exit();
});
process.on('SIGTERM', () => {
    saveScores();
    process.exit();
});

app.post('/', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
        sensorValue: sensorValue1,
        sensorValue2: sensorValue2,
        sensorValue3: sensorValue3,
        sensorValue4: sensorValue4
    }));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
