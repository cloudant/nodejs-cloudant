# Contributing

## Issues

Please [read these guidelines](http://ibm.biz/cdt-issue-guide) before opening an issue.
If you still need to open an issue then we ask that you complete the template as
fully as possible.

## Pull requests

We welcome pull requests, but ask contributors to keep in mind the following:

* Only PRs with the template completed will be accepted
* We will not accept PRs for user specific functionality

### Developer Certificate of Origin

In order for us to accept pull-requests, the contributor must sign-off a
[Developer Certificate of Origin (DCO)](DCO1.1.txt). This clarifies the
intellectual property license granted with any contribution. It is for your
protection as a Contributor as well as the protection of IBM and its customers;
it does not change your rights to use your own Contributions for any other purpose.

Please read the agreement and acknowledge it by ticking the appropriate box in the PR
 text, for example:

- [x] Tick to sign-off your agreement to the Developer Certificate of Origin (DCO) 1.1

## General information

## Requirements

Node.js and npm, other dependencies will be installed automatically via `npm`
and the `package.json` `dependencies` and `devDependencies`.

## Testing

To run tests:

```sh
npm test
```

To run tests with a real, instead of mock, server then use the environment
variable `NOCK_OFF=true`.

You can add verbose debug messages while running tests by doing:

```
DEBUG=* npm test
```

### Test configuration

When testing with a real server (i.e. `NOCK_OFF=true`) these options are
available to set as environment variables:
`cloudant_username` - username
`cloudant_password` - password
`SERVER_URL` - the URL to use (defaults to `https://$cloudant_user.cloudant.com`)
