#!groovy
// Copyright © 2017, 2019 IBM Corp. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

def getEnvForSuite(suiteName) {
  // Base environment variables
  def envVars = [
    "NVM_DIR=${env.HOME}/.nvm"
  ]

  // Add test suite specific environment variables
  switch(suiteName) {
    case 'test':
      envVars.add("NOCK_OFF=true")
      envVars.add("SERVER_URL=${env.SDKS_TEST_SERVER_URL}")
      envVars.add("cloudant_iam_token_server=${env.SDKS_TEST_IAM_SERVER}")
      break
    case 'nock-test':
      break
    default:
      error("Unknown test suite environment ${suiteName}")
  }

  return envVars
}

def installAndTest(version, testSuite) {
  try {
    // Actions:
    //  1. Load NVM
    //  2. Install/use required Node.js version
    //  3. Install mocha-jenkins-reporter so that we can get junit style output
    //  4. Run tests
    sh """
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install ${version}
      nvm use ${version}
      npm install mocha-jenkins-reporter --save-dev
      ./node_modules/mocha/bin/mocha --reporter mocha-jenkins-reporter --reporter-options junit_report_path=./${testSuite}/test-results.xml,junit_report_stack=true,junit_report_name=${testSuite} test --grep 'Virtual Hosts' --invert
    """
  } finally {
    junit '**/test-results.xml'
  }
}

def setupNodeAndTest(version, testSuite='test') {
  node {
    // Install NVM
    sh 'wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash'
    // Unstash the built content
    unstash name: 'built'

    // Run tests using creds
    if(testSuite == 'test') {
      withCredentials([usernamePassword(credentialsId: 'testServerLegacy', usernameVariable: 'cloudant_username', passwordVariable: 'cloudant_password'), string(credentialsId: 'testServerIamApiKey', variable: 'cloudant_iam_api_key')]) {
        withEnv(getEnvForSuite("${testSuite}")) {
          installAndTest(version, testSuite)
        }
      }
    } else {
      withEnv(getEnvForSuite("${testSuite}")) {
        installAndTest(version, testSuite)
      }
    }
  }
}

stage('Build') {
  // Checkout, build
  node {
    checkout scm
    sh 'npm install'
    stash name: 'built'
  }
}

stage('QA') {
  parallel([
    Node12x : {
      // 12.x LTS
      setupNodeAndTest('12')
    },
    Node12xWithNock : {
      setupNodeAndTest('12', 'nock-test')
    },
    Node14x : {
      // 14.x LTS
      setupNodeAndTest('14')
    },
    Node : {
      // 16.x
      setupNodeAndTest('16')
    },
    NodeWithNock : {
      // 16.x
      setupNodeAndTest('16', 'nock-test')
    },
  ])
}

// Publish the master branch
stage('Publish') {
  if (env.BRANCH_NAME == "master") {
    node {
      unstash 'built'

      def v = com.ibm.cloudant.integrations.VersionHelper.readVersion(this, 'package.json')
      String version = v.version
      boolean isReleaseVersion = v.isReleaseVersion

      // Upload using the NPM creds
      withCredentials([string(credentialsId: 'npm-mail', variable: 'NPM_EMAIL'),
                       usernamePassword(credentialsId: 'npm-creds', passwordVariable: 'NPM_TOKEN', usernameVariable: 'NPM_USER')]) {
        // Actions:
        // 1. create .npmrc file for publishing
        // 2. add the build ID to any snapshot version for uniqueness
        // 3. publish the build to NPM adding a snapshot tag if pre-release
        sh """
          echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > .npmrc
          ${isReleaseVersion ? '' : ('npm version --no-git-tag-version ' + version + '.' + env.BUILD_ID)}
          npm publish ${isReleaseVersion ? '' : '--tag snapshot'}
        """
      }
    }
  }

  // Run the gitTagAndPublish which tags/publishes to github for release builds
  gitTagAndPublish {
      versionFile='package.json'
      releaseApiUrl='https://api.github.com/repos/cloudant/nodejs-cloudant/releases'
  }
}
