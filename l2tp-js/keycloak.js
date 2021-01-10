const {getKeycloakUrl} = require("keycloak-lambda-authorizer/src/utils/restCalls");
const {fetchData} = require("keycloak-lambda-authorizer/src/utils/restCalls");

async function getUma2Configuration(options) {
    const keycloakJson = options.keycloakJson(options);
    const { realm } = keycloakJson;
    let uma2Config = await options.cache.get('uma2-configuration', realm);
    if (!uma2Config) {
        const res = await fetchData(`${getKeycloakUrl(keycloakJson)}/realms/${realm}/.well-known/uma2-configuration`);
        uma2Config = JSON.parse(res);
        await options.cache.put('uma2-configuration', realm, JSON.stringify(uma2Config));
    } else {
        uma2Config = JSON.parse(uma2Config);
    }
    return uma2Config;
}

module.exports = {
    getUma2Configuration
};
