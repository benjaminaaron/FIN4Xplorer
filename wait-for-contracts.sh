#!/bin/sh

set -e

# waits until fin4contracts deployed the contracts to the chain
until [ -e src/config/verifier-info.js ]; do
  >&2 echo "FIN4Contracts/src/config/verifier-info.js is not available yet. Waiting for deployment of FIN4Contracts..."
  sleep 5
done
  
>&2 echo "FIN4Contracts/src/config/verifier-info.js is available - starting FIN4Xplorer"
npm run start