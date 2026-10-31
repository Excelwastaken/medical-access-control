FROM docker:29-cli@sha256:5e6baf67325a79f64ed3bed6863954d5e05d0f3d4e57cbdb14809346814bbfdb AS dockercli
FROM jenkins/jenkins:lts-jdk21@sha256:74401de6a6f92e1afe1b02d1c8e3d0c33f263bfb5275dd8813f9150355f2367b
USER root
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
USER jenkins
RUN jenkins-plugin-cli --plugins workflow-aggregator git pipeline-stage-view
COPY init.groovy /usr/share/jenkins/ref/init.groovy.d/assignment.groovy
