docker build -t l2tp-ipsec-radius-docker .
docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:1.3.2_armv7l
docker push vassio/l2tp-ipsec-radius-docker:1.3.2_armv7l

docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:latest_armv7l
docker push vassio/l2tp-ipsec-radius-docker:latest_armv7l
