const fs = require('fs');
const jws = require('jws');
const URI = require("uri-js");

const {clientAuthentication} = require("keycloak-lambda-authorizer/src/clientAuthorization");
const {fetchData} = require("keycloak-lambda-authorizer/src/utils/restCalls");
const {getUma2Configuration} = require("./keycloak");
const {commonOptions} = require("keycloak-lambda-authorizer/src/utils/optionsUtils");
const configPath = process.env['CONFIG_PATH'] || '../examples/config.json';

const RADSEC_TEMPLATE_PROXY_CONF = process.env['RADSEC_TEMPLATE_PROXY_CONF'] || '../etc/radsecproxyRadSec.conf';
const UDP_TEMPLATE_PROXY_CONF = process.env['RADSEC_TEMPLATE_PROXY_CONF'] || '../etc/radsecproxyUDP.conf';
const RADSEC_PROXY_CONF = process.env['RADSEC_PROXY_CONF'] || 'radsecproxy.conf';
const RADIUS_CLIENT = process.env['RADIUS_CLIENT'] || 'radiusclient.conf';
const RADIUS_SERVER = process.env['RADIUS_SERVER'] || 'servers';
const RADSEC_PROXY_FILE = process.env['RADSEC_PROXY_FILE'] || 'radsec.sh';
const RADIUS_ENVS = process.env['RADIUS_ENVS'] || 'envs.sh';
const RADIUS_ROUTES = process.env['RADIUS_ROUTES'] || '.';
const REDIR_SH = process.env['REDIR_SH'] || 'redir.sh';
const TEMPLATE_PPP_OPTIONS = process.env['TEMPLATE_PPP_OPTIONS'] || '../etc/ppp/options.xl2tpd';
const PPP_OPTIONS = process.env['PPP_OPTIONS'] || 'options.xl2tpd';
const ipsecSecretPath = process.env['IPSEC_SECRET'] || 'ipsec.sh';

let radsecCommand = 'logger "skip radsec configuration"';

const stationid = (Math.random() * (9000000 - 1000000) + 1000000) | 0;

function radsecSettings(settings, cJson) {
    let radcli = '';
    let radsecproxyType = UDP_TEMPLATE_PROXY_CONF;
    if (settings.radiusInfo.radsec) {
        if (!fs.existsSync(cJson.radsec.privateKey)) {
            throw new Error('Radsec Private key does not exist')
        }
        if (!fs.existsSync(cJson.radsec.certificateFile)) {
            throw new Error('Radsec Public key does not exist')
        }
        if (!fs.existsSync(cJson.radsec.CACertificateFile)) {
            throw new Error('Radsec CA key does not exist')
        }
        radsecproxyType = RADSEC_TEMPLATE_PROXY_CONF;
    }
    let radsecproxyConf = fs.readFileSync(radsecproxyType, 'utf8');
    let txt = `${cJson.radsec.CertificateKeyPassword ? `CertificateKeyPassword: "${cJson.radsec.CertificateKeyPassword}"` : ''}\n`;
    radsecproxyConf = radsecproxyConf.replace('%options%', txt);
    radsecproxyConf = radsecproxyConf.split('%CACertificateFile%').join(cJson.radsec.CACertificateFile);
    radsecproxyConf = radsecproxyConf.split('%CertificateFile%').join(cJson.radsec.certificateFile);
    radsecproxyConf = radsecproxyConf.split('%CertificateKeyFile%').join(cJson.radsec.privateKey);
    radsecproxyConf = radsecproxyConf.split('%server%').join(settings.host);
    radsecproxyConf = radsecproxyConf.split('%secret%').join(settings.radiusInfo.secret);
    radsecproxyConf = radsecproxyConf.split('%randomId%').join(stationid);
    fs.writeFileSync(RADSEC_PROXY_CONF, radsecproxyConf, 'utf8');
    radsecCommand = 'service radsecproxy start';
    radcli = 'authserver      127.0.0.1:1812\n';
    radcli += 'acctserver      127.0.0.1:1812\n';
    radcli += `servers         /etc/radcli/servers\n`;
    radcli += `dictionary      /etc/radcli/dictionary\n`;
    radcli += `seqfile		/var/run/radius.seq\n`;
    radcli += `mapfile		/etc/radcli/port-id-map\n`;
    radcli += `default_realm ${cJson.keycloak.json.realm}\n`;
    radcli += `bindaddr *\n`;
    radcli += `radius_retries  3\n`;
    radcli += `radius_timeout  10\n`;

    let servers = `127.0.0.1  ${settings.radiusInfo.secret}\n`;
    servers += `localhost  ${settings.radiusInfo.secret}\n`;
    servers += `${settings.host}  ${settings.radiusInfo.secret}\n`;
    let envs = `export COA_PORT=${settings.radiusInfo.coaPort}\n`
    envs += `export USE_COA=${settings.radiusInfo.useCoA}\n`
    envs += `export RAD_SEC=${settings.radiusInfo.radsec}\n`
    envs += `export UDP_RADIUS=${settings.radiusInfo.udpRadius}\n`
    envs += `export STATION_ID=${stationid}\n`
    let redirSet = new Set();
    redirSet.add('logger "setup forwarding"');
    if (cJson.authorizationMap) {
        if (cJson.authorizationMap.roles) {
            Object.entries(cJson.authorizationMap.roles).forEach(((kv) => {
                const name = kv[0];
                const value = kv[1];
                let routes = `logger "set ${name} routing"\n`
                if (value.routes) {
                    routes += value.routes.map(route => {
                        return `/sbin/ip route add ${route} dev  $1`
                    }).join('\n')
                }
                if (value.forwarding) {
                    routes += value.forwarding.map(f => {
                        redirSet.add(`redir -s :${f.externalPort} ${f.sourceIp}:${f.sourcePort}`);
                        return `/sbin/ip route add ${f.sourceIp} dev  $1`
                    }).join('\n');

                }
                fs.writeFileSync(`${RADIUS_ROUTES}/${name}_routes.sh`, routes, 'utf8');
            }));
        }
    }
    let templatePPP = fs.readFileSync(TEMPLATE_PPP_OPTIONS, 'utf8');
    const protocol = cJson.radius.protocol || 'mschap-v2';
    if (!['pap', 'chap', 'mschap-v2'].includes(protocol)) {
        throw new Error("Protocol " + protocol + " does not supported. Supported only pap,chap and mschap-v2");
    }
    templatePPP += `\n+pap\n+chap\n+mschap-v2\nrequire-${protocol}\nplugin radius.so\nplugin radattr.so\n`

    if (cJson.ipsec && cJson.ipsec.secret){
        const ipsec_secret = `echo '%any  %any  : PSK "${cJson.ipsec.secret}"' > /etc/ipsec.secrets`;
        fs.writeFileSync(ipsecSecretPath, ipsec_secret);
    } else {
        throw new Error('ipsec secret is empty');
    }
    fs.writeFileSync(PPP_OPTIONS, templatePPP, 'utf8');
    fs.writeFileSync(RADIUS_ENVS, envs, 'utf8');
    fs.writeFileSync(RADIUS_SERVER, servers, 'utf8');
    fs.writeFileSync(RADIUS_CLIENT, radcli, 'utf8');
    fs.writeFileSync(RADSEC_PROXY_FILE, radsecCommand, 'utf8');
    fs.writeFileSync(REDIR_SH, Array.from(redirSet).join('\n'), 'utf8');
}

async function parseFile(cJson) {
    const settings = {};
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
            const url = `${cJson.keycloak.json['auth-server-url']}realms/${cJson.keycloak.json.realm}/radius/v1/radius/info?calledStationId=${stationid}`;
            settings.radiusInfo = JSON.parse(await fetchData(url, 'GET', {
                'Authorization': `Bearer ${jwt.access_token}`
            }));
            settings.host = URI.parse(cJson.keycloak.json['auth-server-url']).host;
            radsecSettings(settings, cJson)
        } else {
            throw new Error('Keycloak setting is empty');
        }

    } catch (e) {
        throw new Error(e);
    }
}

const f = fs.readFileSync(configPath, 'utf8');

const configJson = JSON.parse(f);
parseFile(configJson).then().catch((e) => {
    throw e
})

