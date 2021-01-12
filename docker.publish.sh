docker build -t l2tp-ipsec-radius-docker .
docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:1.3.2
docker push vassio/l2tp-ipsec-radius-docker:1.3.2

docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:latest
docker push vassio/l2tp-ipsec-radius-docker:latest
