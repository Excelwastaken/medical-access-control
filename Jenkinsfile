pipeline {
    agent any
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    parameters {
        booleanParam(name: 'LOCAL_SOURCE', defaultValue: false,
            description: 'Use mounted unpublished files. Turn off only after publishing this pipeline to GitHub.')
        string(name: 'GIT_BRANCH', defaultValue: 'assignment/assignment-5-ci', description: 'Published GitHub branch to test')
    }
    triggers {
        pollSCM(params.LOCAL_SOURCE == false ? 'H/2 * * * *' : '')
    }
    environment {
        TEST_IMAGE = "medical-access-analysis-tests:${BUILD_NUMBER}"
        APP_IMAGE = "medical-access-analysis:jenkins-${BUILD_NUMBER}"
        RUN_CONTAINER = "medical-analysis-run-${BUILD_NUMBER}"
    }
    stages {
        stage('Prepare source') {
            steps {
                deleteDir()
                script {
                    if (params.LOCAL_SOURCE) {
                        sh '''mkdir -p analysis backend
                            cp /source/analysis/analyze.py /source/analysis/Dockerfile /source/analysis/.dockerignore analysis/
                            cp -R /source/analysis/tests analysis/
                            cp /source/results.json backend/evaluation-results-repeated.json
                            printf 'Source: local unpublished snapshot\n' > source.txt
                            sha256sum analysis/analyze.py analysis/Dockerfile analysis/tests/*.py backend/evaluation-results-repeated.json >> source.txt
                        '''
                    } else {
                        git branch: params.GIT_BRANCH,
                            url: 'https://github.com/Excelwastaken/medical-access-control.git'
                        sh 'git rev-parse HEAD > source.txt'
                    }
                }
            }
        }
        stage('Unit tests') {
            steps {
                sh 'docker build --target test -t "$TEST_IMAGE" analysis'
                // Execute on every build, even when Docker build layers are cached.
                sh 'docker run --rm --network none --entrypoint python "$TEST_IMAGE" -m unittest discover -s tests -t . -v > tests.log 2>&1'
                sh 'cat tests.log'
            }
        }
        stage('Build Docker image') {
            steps {
                sh 'docker build -t "$APP_IMAGE" analysis'
                sh 'docker image inspect "$APP_IMAGE" > image-metadata.json'
            }
        }
        stage('Analyze research results') {
            steps {
                script {
                    // Copy files rather than bind-mount Jenkins paths into the host Docker daemon.
                    sh '''docker create --name "$RUN_CONTAINER" --network none "$APP_IMAGE" /app/results.json --output-dir /output
                        docker cp backend/evaluation-results-repeated.json "$RUN_CONTAINER":/app/results.json
                    '''
                    def status = sh(script: 'docker start -a "$RUN_CONTAINER"', returnStatus: true)
                    sh 'mkdir -p reports && docker cp "$RUN_CONTAINER":/output/. reports/'
                    if (status != 0) {
                        error("Research analysis failed (exit ${status}); inspect archived reports.")
                    }
                }
            }
        }
    }
    post {
        always {
            archiveArtifacts artifacts: 'source.txt,tests.log,image-metadata.json,reports/*',
                allowEmptyArchive: true, fingerprint: true
            sh 'docker rm -f "$RUN_CONTAINER" >/dev/null 2>&1 || true'
        }
    }
}
