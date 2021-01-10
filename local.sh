docker stop l2tp-ipsec-radius-docker
docker rm l2tp-ipsec-radius-docker

docker build -t l2tp-ipsec-radius-docker .
docker run --name=l2tp-ipsec-radius-docker -v /home/vzakharchenko/home/pptp-radius-docker/key.pem:/opt/key.pem -v /home/vzakharchenko/home/pptp-radius-docker/cert.pem:/opt/cert.pem  -v /home/vzakharchenko/home/l2tp-ipsec-radius-docker/examples/example.json:/opt/config.json  -p 3799:3799 -p 500:500/udp -p 4500:4500/udp  --privileged l2tp-ipsec-radius-docker
