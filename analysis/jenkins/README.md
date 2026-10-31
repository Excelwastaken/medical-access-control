# Local Jenkins for Assignment 5

Run from the repository root:

```sh
docker compose -p medical-assignment -f analysis/jenkins/compose.yaml up -d --build
```

Open http://localhost:8081/. Username: `assignment-admin`.
Retrieve the generated password locally (do not put it in a report or commit it):

```sh
docker exec medical-assignment-jenkins cat /var/jenkins_home/secrets/assignment-admin-password
```

This authenticated server listens only on loopback. The Docker socket grants Jenkins control
of the local Docker engine. Use this local lab only for trusted project code; do not expose it
to a network or execute untrusted pull requests. The Jenkins home volume retains credentials,
jobs, logs and archived reports. Stop without deleting it:

```sh
docker compose -p medical-assignment -f analysis/jenkins/compose.yaml stop
```

## First run: unpublished local source

The initialization script creates `medical-access-analysis` with the root Jenkinsfile.
For unpublished files, select **Build with Parameters** with `LOCAL_SOURCE=true`. The published pipeline defaults to GitHub mode on branch `assignment/assignment-5-ci`.
Stages prepare a snapshot, run Python unit tests, build the runtime image, and analyze the
existing repeated evaluation JSON. This does not run new blockchain experiments.
The runtime container has no network access. Inputs are copied in; generated reports are copied out.
Artifacts include the English report, JSON results, input/source hashes, test output and image metadata.
Capture the successful stage view and console output for the assignment.

In this mode no GitHub polling is enabled. Local edits require a new manual build.
The job initially stores a copy of the Jenkinsfile; changes to that file require updating
the job's Pipeline script through Configure, or switching to Pipeline script from SCM below.

## Enable GitHub CI after publishing the assignment files

1. Commit and push the analyzer, its Docker files, and the root Jenkinsfile to your chosen branch.
2. In the job configuration, choose **Pipeline script from SCM**, SCM **Git**,
   repository `https://github.com/Excelwastaken/medical-access-control.git`,
   branch `*/YOUR_BRANCH`, script path `Jenkinsfile`. Use Jenkins credentials if the repository is private.
3. Run with `LOCAL_SOURCE=false` and `GIT_BRANCH=YOUR_BRANCH`.
4. After this run, check that **Poll SCM** is enabled. The pipeline checks for changes every two minutes.
5. Change the default `LOCAL_SOURCE` value in the versioned Jenkinsfile to `false` before relying
   on unattended builds. Set its default branch to your chosen published branch as well.
6. Verify automation with a new commit and retain evidence of the triggered build.

Polling may coalesce closely spaced commits into one build. For individual push events,
configure a reachable authenticated webhook-based setup instead of exposing this local lab.
Until these steps are completed, do not claim automatic GitHub-triggered execution.

Jenkins and Docker CLI base images are pinned by digest. Plugin dependencies are resolved
at build time; the Jenkins setup is not a fully locked dependency snapshot.
This pipeline covers the Python analysis component; existing blockchain tests remain in GitHub Actions.

## Published assignment branch

The assignment uses branch `assignment/assignment-5-ci`. After configuring Pipeline script from SCM,
leave `LOCAL_SOURCE=false` and `GIT_BRANCH=assignment/assignment-5-ci`. Polling checks for changes
every two minutes while Jenkins and Docker Desktop are running. No public webhook endpoint is required.
