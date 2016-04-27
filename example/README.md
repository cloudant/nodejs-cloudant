# Node.js CRUD example

## Install dependencies

```
npm install
```

## Set credentials

Create an environment variable with your Cloudant credentials e.g.

```
export CLOUDANT_URL=https://myusername:mypassword@mydomain.cloudant.com
```

## Run

```
node crud.js
```

This creates a database called `crud`, adds a document `mydoc`, reads it back, updates it, deletes it and then deletes the database.
