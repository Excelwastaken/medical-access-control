import jenkins.model.Jenkins
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition
import jenkins.model.JenkinsLocationConfiguration

def j = Jenkins.get()
def marker = new File(j.rootDir, 'assignment-initialized')
if (!marker.exists()) {
    def password = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    def realm = new HudsonPrivateSecurityRealm(false)
    realm.createAccount('assignment-admin', password)
    j.setSecurityRealm(realm)
    def authorization = new FullControlOnceLoggedInAuthorizationStrategy()
    authorization.setAllowAnonymousRead(false)
    j.setAuthorizationStrategy(authorization)
    def passwordFile = new File(j.rootDir, 'secrets/assignment-admin-password')
    passwordFile.parentFile.mkdirs()
    passwordFile.text = password
    passwordFile.setReadable(false, false)
    passwordFile.setReadable(true, true)
    JenkinsLocationConfiguration.get().setUrl('http://localhost:8081/')
    j.setNumExecutors(1)
    j.setSlaveAgentPort(-1)
    def job = j.createProject(WorkflowJob, 'medical-access-analysis')
    job.setDefinition(new CpsFlowDefinition(new File('/source/Jenkinsfile').getText('UTF-8'), true))
    job.setDescription('Assignment 5: tests, Docker build and analysis of recorded research results. Local mode until GitHub publication.')
    job.save()
    j.save()
    marker.text = 'Initialized local assignment Jenkins.\n'
}
