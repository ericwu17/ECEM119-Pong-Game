// based on the example on https://www.npmjs.com/package/@abandonware/noble

const noble = require('@abandonware/noble');

const uuid_service = "a00693f9-f9ed-4fcc-8f89-e9b05dd65746"
const uuid_value1 = "2102"        // first characteristic
const uuid_value2 = "2103"        // second characteristic (new)

let sensorValue1 = NaN              // value for uuid_value1
let sensorValue2 = NaN              // value for uuid_value2

noble.on('stateChange', async (state) => {
    if (state === 'poweredOn') {
        console.log("start scanning")
        await noble.startScanningAsync([uuid_service], false);
    }
});

noble.on('discover', async (peripheral) => {
    await noble.stopScanningAsync();
    await peripheral.connectAsync();
    const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
        [uuid_service],
        [uuid_value1, uuid_value2]
    );
    // characteristics array may contain both values; match by uuid
    const char1 = characteristics.find(c => c.uuid === uuid_value1);
    const char2 = characteristics.find(c => c.uuid === uuid_value2);
    if (char1) readData1(char1);
    if (char2) readData2(char2);
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

//
// hosting a web-based front-end and respond requests with sensor data
// based on example code on https://expressjs.com/
//
const express = require('express')
const app = express()
const port = 3000

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index')
})

app.post('/', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
        sensorValue: sensorValue1,
        sensorValue2: sensorValue2
    }));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
