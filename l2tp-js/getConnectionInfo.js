const fs = require('fs');
const jws = require('jws');
const {exec} = require('child_process');
const {clientAuthentication} = require("keycloak-lambda-authorizer/src/clientAuthorization");
const {fetchData} = require("keycloak-lambda-authorizer/src/utils/restCalls");
const {getUma2Configuration} = require("./keycloak");
const {commonOptions} = require("keycloak-lambda-authorizer/src/utils/optionsUtils");
const RADIUS_ROUTES = process.env['RADIUS_ROUTES'] || '.';
const STATION_ID = process.env['STATION_ID'] || '123456';

const args = process.argv.slice(2);

const CONNECTED_IP = args[0];
const CONNECTED_INTERFACE = args[1];

console.log = (text)=>{
    return exec(`logger "${text}"`);
}

console.log(`Connected ${CONNECTED_IP} ${CONNECTED_INTERFACE}`);


const configPath = process.env['CONFIG_PATH'] || '../examples/config.json';

console.log(`configPath ${configPath}`)
execute = (command)=> exec(command,
    function (error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ' + error+ ' , '+stderr);
        }
    });

async function parseFile(cJson) {
    try {

        if (!cJson.keycloak) {
            throw new Error('Keycloak setting is empty');
        }
        if (cJson.keycloak.token) {
            const decodedToken = jws.decode(cJson.keycloak.token);
            throw new Error(JSON.stringify(decodedToken) + ' unsupported yet')
        } else if (cJson.keycloak.json) {
            const options = commonOptions({}, cJson.keycloak.json);
            const uma2Config = await getUma2Configuration(options);
            const jwt = await clientAuthentication(uma2Config, options);
            const url = `${cJson.keycloak.json['auth-server-url']}realms/${cJson.keycloak.json.realm}/radius/v1/radius/users?ip=${CONNECTED_IP}&calledStationId=id${STATION_ID}`;
            const userInfo = JSON.parse(await fetchData(url, 'GET', {
                'Authorization': `Bearer ${jwt.access_token}`
            }));
            console.log(`userInfo:${JSON.stringify(userInfo)}`)
            if (cJson.authorizationMap){
                if (userInfo.roles && cJson.authorizationMap.roles){
                    Object.keys(cJson.authorizationMap.roles).forEach((role)=>{
                        if (userInfo.roles.includes(role)){
                            execute(`logger "run role ${RADIUS_ROUTES}/${role}_routes.sh"`);
                            execute(`${RADIUS_ROUTES}/${role}_routes.sh ${CONNECTED_INTERFACE}`);
                        }
                    })
                }
            }

        } else {
            throw new Error('Keycloak setting is empty');
        }

    } catch (e) {
        console.log("Error "+e)
        throw new Error(e);
    }
}
//
// function sleepFor( sleepDuration ){
//     var now = new Date().getTime();
//     while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
// }

const f = fs.readFileSync(configPath, 'utf8');

const configJson = JSON.parse(f);

parseFile(configJson).then().catch((e) => {
    console.log(e)
    throw e
})
