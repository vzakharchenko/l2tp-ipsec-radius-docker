const radius = require('radius');
const {exec} = require('child_process');
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const SECRET = process.env.SECRET || 'secret';
const COA_PORT = process.env.COA_PORT || 3799;
const STATION_ID = process.env.STATION_ID || 123456;

console.log = (text) => {
    return exec(`logger "${text}"`);
}

child = (int) => exec(`ip link delete ` + int,
    function (error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ' + error + ' ; message: ' + stderr);
        }
    });
ipAll = () => new Promise((resolve, reject) => {
    exec('ip -j a',
        function (error, stdout, stderr) {
            if (error !== null) {
                reject(error);
            }
            resolve(stdout);
        });
})

async function getInterfacesByIp(ip) {
    const interfaces = JSON.parse(await ipAll());
    return interfaces.map((intf) => {
        return intf.addr_info.find((v) => {
            return v.address === ip
        }) ? intf.ifname : null
    }).filter(value => !!value);
}

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});


server.on('message', async (msg, rinfo) => {
    const packet = radius.decode({packet: msg, secret: SECRET});
    // console.log(`server got: ${JSON.stringify(packet)} from ${rinfo.address}:${rinfo.port}`);
    const stationId = packet.attributes['Called-Station-Id'];
    if (stationId === `id${STATION_ID}`) {
        const ip = packet.attributes['Framed-IP-Address'];
        console.log(`IP from interface: ${ip}`);
        const interfaces = await getInterfacesByIp(ip);
        interfaces.forEach(intf => {
            child(intf)
        })
    } else {
        console.log(`Incorrect Device Id ${stationId}`);
    }

    const encodeResponse = radius.encode_response({
        packet,
        secret: SECRET,
        code: 'Disconnect-ACK',
    });

    server.send(encodeResponse, 0, encodeResponse.length, rinfo.port, rinfo.address, function (err, bytes) {
        if (err) {
            console.log('Error sending response to ', rinfo);
        }
    });

});

server.on('listening', () => {
    const address = server.address();
    console.log(`CoA server listening ${address.address}:${address.port}`);
});

server.bind(COA_PORT);
