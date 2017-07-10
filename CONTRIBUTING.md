# Developer Certificate of Origin

In order for us to accept pull-requests, the contributor must sign-off a
[Developer Certificate of Origin (DCO)](DCO1.1.txt). This clarifies the
intellectual property license granted with any contribution. It is for your
protection as a Contributor as well as the protection of IBM and its customers;
it does not change your rights to use your own Contributions for any other
purpose.

Please read the agreement and acknowledge it by ticking the appropriate box in
the PR text, for example:

- [x] Tick to sign-off your agreement to the Developer Certificate of Origin (DCO) 1.1

# Contributing

Everyone is welcome to contribute with patches, bug-fixes and new features.

1. Create an [issue](http://github.com/cloudant/nodejs-cloudant/issues) on GitHub so the community can comment on your idea.
2. Fork the repository in GitHub.
3. Create a new branch `git checkout -b my_branch`.
4. Create tests for the changes you made.
5. Make sure you pass both existing and newly inserted tests.
6. Commit your changes.
7. Push to your branch `git push origin my_branch`.
8. Create a pull request.

To run tests make sure you npm test but also run tests without mocks:

``` sh
npm run test-cloudant
```

You can add verbose debug messages while running tests by doing:

```
DEBUG=* node your_scripts.js
```

You can turn nocks on and off using the `NOCK_OFF` environment variable.
