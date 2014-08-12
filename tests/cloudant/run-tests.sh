if [ "$NOCK" ]; then
  echo "Test against mocked local database"
else
  echo "Test against remote Cloudant database"
  if [ -z "$npm_config_cloudant_password" ]; then
    echo "No password configured for remote Cloudant database. Please run:" >&2
    echo "" >&2
    echo "npm config set cloudant_password \"<your-password>\"" >&2
    exit 1
  fi
fi

# Since npm ran, it is safe to assume the current working directory is the project root.
set -e

if [ "$cloudant_test" ]; then
  node "tests/cloudant/$cloudant_test.js"
else
  for file in tests/cloudant/*.js ; do
    node "$file"
  done
fi
