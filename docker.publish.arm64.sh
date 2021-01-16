docker build -t l2tp-ipsec-radius-docker .
docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:1.3.2@arm64
docker push vassio/l2tp-ipsec-radius-docker:1.3.2@arm64

docker tag  l2tp-ipsec-radius-docker vassio/l2tp-ipsec-radius-docker:latest@arm64
docker push vassio/l2tp-ipsec-radius-docker:latest@arm64
