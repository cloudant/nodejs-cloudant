Everyone is welcome to contribute with patches, bug-fixes and new features.

1. Create an [issue](issues) on github so the community can comment on your idea.
2. Fork `nodejs-cloudant` in GitHub.
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

[Check this blog post](http://writings.nunojob.com/2012/05/Mock-HTTP-Integration-Testing-in-Node.js-using-Nock-and-Specify.html) to learn more about how to write your own tests.

[issues]: http://github.com/cloudant/nodejs-cloudant/issues
