#!/bin/bash

set -e
service rsyslog restart
iptables-restore < /etc/iptables/rules.v4

# service pptpd restart
# /opt/redir.sh
sed -i '$ d' /opt/src/run.sh
sed -i '/IPsec PSK:/d' /opt/src/run.sh
sed -i '/Username:/d' /opt/src/run.sh
sed -i '/Password:/d' /opt/src/run.sh
/opt/src/run.sh
sed -i '/refuse pap = yes/d' /etc/xl2tpd/xl2tpd.conf
sed -i '/require chap = yes/d' /etc/xl2tpd/xl2tpd.conf
sed -i '/+mschap-v2/d' /etc/xl2tpd/xl2tpd.conf
sed -i '/+mschap-v2/d' /etc/ppp/options.xl2tpd

echo "export RADSEC_TEMPLATE_PROXY_CONF=/opt/etc/radsecproxyRadSec.conf">/opt/envs_docker.sh
echo "export UDP_TEMPLATE_PROXY_CONF=/opt/etc/radsecproxyUDP.conf">/opt/envs_docker.sh
echo "export RADSEC_PROXY_CONF=/etc/radsecproxy.conf">>/opt/envs_docker.sh
echo "export RADIUS_CLIENT=/etc/radcli/radiusclient.conf">>/opt/envs_docker.sh
echo "export RADIUS_SERVER=/etc/radcli/servers">>/opt/envs_docker.sh
echo "export RADSEC_PROXY_FILE=/opt/radsec.sh">>/opt/envs_docker.sh
echo "export RADIUS_ENVS=/opt/envs.sh">>/opt/envs_docker.sh
echo "export RADIUS_ROUTES=/opt/roles">>/opt/envs_docker.sh
echo "export CONFIG_PATH=/opt/config.json">>/opt/envs_docker.sh
echo "export REDIR_SH=/opt/redir.sh">>/opt/envs_docker.sh
chmod +x /opt/envs_docker.sh
rm -rf /opt/roles
mkdir -p /opt/roles

node /opt/l2tp-js/parsingConfigFile.js
chmod -R +x /opt/roles
chmod +x /opt/radsec.sh
source /opt/envs.sh
chmod +x /opt/redir.sh

#echo "mschap-v2" >> /etc/ppp/options.xl2tpd
#echo "pap" >> /etc/ppp/options.xl2tpd
chmod +x /opt/redir.sh
#chmod +x /opt/enc_passwords.sh
chmod +x /opt/ipsecSecret.sh
chmod +x /etc/ppp/ip-up.d/routes-up
#/opt/enc_passwords.sh
/opt/ipsecSecret.sh
service ipsec restart
service xl2tpd restart
if [[ "x${RAD_SEC}" = "xtrue" ]]; then
  /opt/radsec.sh
fi
if [[ "x${USE_COA}" = "xtrue" ]]; then
 pm2 start /opt/coa/server.js
fi
/opt/redir.sh
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
netstat -tulpn >> /var/log/messages
tail -f /var/log/messages

