/* Script to test and deploy org sources
V0 N.Vuillamy: Initial version
*/
//////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// GRABS/IMPORTS ////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
import groovy.io.FileType
import groovy.json.*
import groovy.time.TimeCategory
import groovy.transform.Field
import groovy.xml.*

import java.io.File

import static groovyx.gpars.GParsPool.withPool

def script = new GroovyScriptEngine( '.' ).with {
  loadScriptByName( 'Utils.groovy' )
}
this.metaClass.mixin script

//////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// INIT ///////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
def returnCode = 0 ;
Exception eThrow = null ;
try {
    initialize(args);
} catch (Exception e) {
    eThrow = e ;
    returnCode = 1 ;
}

// Free server memory by unloading dynamically loaded classes
GroovyClassLoader groovyClassLoader = this.class.getClassLoader()
def unloadedClasses = [] ;
for (Class<?> groovyClass : groovyClassLoader.getLoadedClasses()) {
    GroovySystem.getMetaClassRegistry().removeMetaClass(groovyClass);
    unloadedClasses << groovyClass
}

if (eThrow == null) {
    return 0 ;
}
else {
    throw eThrow ;
    return 1 ;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// SCRIPT /////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

def initialize(args3) {   //
    if (args.size() == 0)
        return ;

    def executor = new SfdxManagementExecutor(args3);
    return executor ;
}


class SfdxManagementExecutor {

    // params
    String devHubName = 'DevHub';
    String sourceEnvName = 'sourceEnvName_MUST_BE_SENT_AS_PARAM';
    String projectDir = 'Projects'; // Always the same, no need to send it as a BAT argument
    String usernameSuffix = 'dxc-scratch.com' ;
    String sfdxSourcesFolder = 'force-app/main/default' ;
    Integer scratchOrgDuration ;
    Boolean jsonLog = false ;
    def jsonLogContent = [:] ;

    String projectName ; // Name of the SFDX Project if not set, will be prompted during script execution
    String scratchOrgAlias ; // Alias of the scratch org to manipulate
    String scratchOrgNameKey ;
    String scratchOrgUserEmail ;
    String projectScratchDefName ;
    String packagingOrgAlias ; // Alias of the packaging org to manipulate
    String packageXmlFile ;
    Boolean doNotReuseScratchOrg = false ;
    def additionalPackageXmlFiles = [];
    def packageList = [];
    def permissionSetList ;
    String themeToProcess = "main" ;
    String userUsername ;
    String userLastName ;
    String userFirstName ;
    String userCountry ;
    String defaultUserLastName = 'De Majipoor'
    String defaultUserFirstName = 'Valentin'
    String defaultUserCountry = 'France'
    String userEmail ;
    String apexCodeFile ;
    String exportQuery ;
    String exportFolder ;

    String metadatasDeployFolder = 'mdapi_output_dir'
    String metadatasDeployFolderOutput = 'mdapi_output_dir_filtered'
    Boolean promptForReloadMetadatas = true

    Boolean loadMetadatas = false;

    String globalKeyPrefix ;

    // Player vars
    String playerScriptsFolder = './PlayerScripts';
    String playerJarLocation = 'DxcOmnichannelPlayer.jar';
    String playerConfigFile = 'config_Player_jenkins_generic.ini' ;

    // PMD / CPD params
    String pmdpath = ''
    String cpdMinimumTokens = 150 ;
    String cpdConfigFile = './Config/pmd/cpdConfig.json'

    String url ;
    Integer timeoutInSeconds = 60 ;

    def scssProcessList = [] ;

    String ownConfigFile = 'myConfig.json'
    Boolean ignoreOwnConfigFile = false
    String sharedConfigFile = 'sharedConfig.json'
    Integer scratchOrgExpiryWarningDaysNb = 5

    Boolean scratchHasJustBeenCreated = false; // Flag to remember that a scratch is really created (not an update)

    // Internal
    def connectedOrgsAliasList = [] ;
    def forceOrgListCache = null ;
    def orgInfoListCache = [:]
    def usrInfoListCache = [:]
    Boolean createScratchOrgMode = false ;
    String currentProjectPath ;
    Boolean browseAllOrgs = false

        public SfdxManagementExecutor( args2) {
            def cli = new CliBuilder(usage: 'SfdxManagement.groovy -arguments')

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NV : Put real and explanative help, with examples : as a donkey i have no idea what to send in "env" when i see "help on env" !!!  ////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            // Create the list of options.
            cli.with {
                devHubName longOpt: 'devHubName', args: 1, argName: 'devHubName', 'Alias of Development hub org. Can be left blank, default value DevHub will be used'
                sourceEnvName longOpt: 'sourceEnvName', args: 1, argName: 'sourceEnvName', 'Alias of source dev org. Can be left blank, default value DevRoot will be used'

                projectDir longOpt: 'projDir', args: 1, argName: 'projDir', 'Directory where to store SFDX Projects. "Projects" by default'
                projectName longOpt: 'projName', args: 1, argName: 'projName', 'Name of the SFDX Project. If not set, will be prompted during script execution'
                sfdxSourcesFolder longOpt: 'sfdxSourcesFolder', args: 1, argName : 'sfdxSourcesFolder', 'Folder where SFDX sources are located (default force-app/main/default)'
                scratchOrgAlias longOpt: 'scratchOrgAlias', args: 1, argName: 'scratchOrgAlias', 'Alias of the scratch org to manipulate. If not set, will be prompted during script execution'
                scratchOrgNameKey longOpt: 'scratchOrgNameKey', args: 1, argName: 'scratchOrgNameKey', 'Key to search in active scratch orgs to try to reuse them'

                scratchOrgUserEmail longOpt: 'scratchOrgUserEmail', args: 1, argName: 'scratchOrgUserEmail', 'User e-mail to initialize scratch org'
                scratchOrgDuration longOpt: 'scratchOrgDuration', args: 1, argName: 'scratchOrgDuration', 'Duration for new scratch org (default 30)'
                packagingOrgAlias longOpt: 'packagingOrgAlias', args: 1, argName: 'packagingOrgAlias', 'Alias of the packaging org to manipulate. If not set, will be prompted during script execution'

                ignoreMyConfigFile longOpt: 'ignoreMyConfigFile', 'Send this parameter if you do not want to myConfig.json to be read during execution'
                globalKeyPrefix longOpt: 'globalKeyPrefix', args: 1, argName: 'globalKeyPrefix', 'Prefix key for external trace storage API calls'
                doNotReuseScratchOrg longOpt: 'doNotReuseScratchOrg', 'Send this argument if u dont want to reuse an existing scratch org when possible'

                packageXmlFile longOpt: 'packageXmlFile', args: 1, argName: 'packageXmlFile', 'Path of package.xml file to use for the metadata API retrieve , or for filtering before deploy'
                additionalPackageXmlFiles longOpt: 'additionalPackageXmlFiles', args: 1, argName: 'additionalPackageXmlFiles', 'List of path of package.xml files to use for filtering before deploy (after initial deployment with packageXmlFile argument value has been done)'

                metadatasDeployFolder longOpt: 'metadatasDeployFolder', args: 1, argName: 'metadatasDeployFolder', 'Ant deployment folder'
                metadatasDeployFolderOutput longOpt: 'metadatasDeployFolderOutput', args: 1, argName: 'metadatasDeployFolderOutput', 'Ant deployment folder (filtered)'
                apexCodeFile longOpt: 'apexCodeFile', args: 1, argName: 'apexCodeFile', 'Path to .apex file to run after scratch org generation'

                packagesToInstall longOpt: 'packagesToInstall', args: 1, argName: 'packagesToInstall', 'List of Ids of packages to install. Format can be xxxxxxx|MyPackageName , or http://mypackageurl.com|myPackageName . Separate packages by commas if there are several to install'

                userUsername longOpt: 'userUsername', args: 1, argName: 'userUsername', 'Username for the scratch org user to create'
                userLastName longOpt: 'userLastName', args: 1, argName: 'userLastName', 'Last name of the scratch org user to create'
                userFirstName longOpt: 'userFirstName', args: 1, argName: 'userFirstName', 'First name of the scratch org user to create'
                userEmail longOpt: 'userEmail', args: 1, argName: 'userEmail', 'E-mail of the scratch org user to create'

                permSetsToAssign longOpt: 'permSetsToAssign', args: 1, argName: 'permSetsToAssign', 'List of permission sets to assign to the scratch org user'

                exportQuery longOpt: 'exportQuery', args: 1, argName: 'exportQuery', 'SOQL Query for data export'
                exportFolder longOpt: 'exportFolder', args: 1, argName: 'exportFolder', 'Folder for data export'

                loadMetadatas longOpt: 'loadMetadatas', 'Propose to load metadatas if not loaded'

                themeToProcess longOpt: 'themeToProcess', args: 1, argName: 'themeToProcess', 'Theme to process: main,all,name of the theme, or select ( user choice )'

                noPush longOpt: 'noPush', 'Send this parameter if you do not want to push SFDX project during scratch org creation'
                initWithFilteredMetadatas longOpt: 'initWithFilteredMetadatas', 'Send this parameter if you want to initialize a scratch org with filtered metadatas'

                runOpenScratchOrg longOpt: 'runOpenScratchOrg', 'Open an existing scratch org'
                runDeleteScratchOrg longOpt: 'runDeleteScratchOrg', 'Delete an existing scratch org'
                runDeleteScratchOrgAll longOpt: 'runDeleteScratchOrgAll', 'Browse ALL scratch orgs for deletion, not only the ones of the current user'
                runFullOrgCreation longOpt: 'runFullOrgCreation', 'Full Org Creation'
                runGeneratePassword longOpt: 'runGeneratePassword', 'Generate password for main scratch org user'
                runTestClasses longOpt: 'runTestClasses', 'Run apex test classes'

                runPullScratchOrg longOpt: 'runPullScratchOrg', 'Pull scratch org into local SFDX project'

                runPushSfdxProjectToScratchOrg longOpt: 'runPushSfdxProjectToScratchOrg', 'Push local SFDX Project to scratch org, to keep it up to date'
                 runConvertSfdxProjectToMetadata longOpt: 'runConvertSfdxProjectToMetadata', 'Convert SFDX Project into metadatas'
                  runDeploySfdxProjectToSourceEnv longOpt: 'runDeploySfdxProjectToSourceEnv', 'Deploy Metadatas from SFDX Project into source org '

                runSassProcessing longOpt : 'runSassProcessing', 'Run Sass Processing'
                runFixSfdxProject longOpt : 'runFixSfdxProject', 'Run Fix SFDX Project (temp SFDC Bug to manually solve)'
                runAssignPermissionSets longOpt : 'runAssignPermissionSets', 'Run permission sets assignment'
                runApexCode longOpt : 'runApexCode', 'Run apex code'
                runTestCase longOpt : 'runTestCase', 'Run test case (user guided choice)'
                runAutomatedTestingToolScratch longOpt : 'runAutomatedTestingToolScratch', 'Run automated testing tool on scratch org'
                runPushSFDXProjectInScratchOrg longOpt : 'runPushSFDXProjectInScratchOrg', 'Push SFDX Project content to existing scratch org'
                runScratchUserCreation longOpt : 'runScratchUserCreation', 'Create a scratch org user'

                runExportData longOpt : 'runExportData', 'Export data'
                runImportData longOpt : 'runImportData', 'Import data'

                runListAllOrgs longOpt : 'runListAllOrgs', 'List all orgs'
                   runListDevHubActiveScratchOrgs longOpt : 'runListDevHubActiveScratchOrgs', 'List dev hub active scratch orgs'

                runCreateNewSFDXProjectWithSourceEnvMetadatas longOpt : 'runCreateNewSFDXProjectWithSourceEnvMetadatas', 'Run retrieve metadatas from source org into SFDX Project. WARNING: DANGEROUS, CAN BREAK EVRYTHING IF YOU GIT PUSH AFTER'

                runGenerateManagedPackage longOpt : 'runGenerateManagedPackage', 'Generate a managed package'

                runCheckCodeConsistency longOpt : 'runCheckCodeConsistency', 'Checks code consistency'
                pmdpath longOpt: 'pmdpath', args: 1, argName: 'pmdpath', 'Path to PMD executable'
                runCheckPackageConsistency longOpt : 'runCheckPackageConsistency', 'Checks managed package consistency'

                runRetrieveSourceOrgMetadata longOpt : 'runRetrieveSourceOrgMetadata', 'Retrieve metadatas from a source org'

                runWaitCommunityActive longOpt : 'runWaitCommunityActive', 'Wait for a community to be active ( url , timeoutInSeconds )'
                url longOpt: 'url', args: 1, argName: 'url', 'URL'
                timeoutInSeconds longOpt: 'timeoutInSeconds', args: 1, argName: 'timeoutInSeconds', 'Timeout in seconds'

                jsonLog longOpt : 'jsonLog', 'Print log as JSON'

            }

            def options = Utils.parseArgs(cli,args2,this);

            // Initialize class properties with arguments
            if (options.'projectDir' && options.'projectDir' != 'false')
                this.projectDir = options.'projectDir' ;

            if (options.'sfdxSourcesFolder' && options.'sfdxSourcesFolder' != 'false')
                this.sfdxSourcesFolder = options.'sfdxSourcesFolder' ;

            if (options.'scratchOrgAlias' && options.'scratchOrgAlias' != 'false')
                this.scratchOrgAlias = options.'scratchOrgAlias' ;
            if (options.'scratchOrgNameKey' && options.'scratchOrgNameKey' != 'false')
                this.scratchOrgNameKey = options.'scratchOrgNameKey' ;
                if (scratchOrgNameKey != null && scratchOrgNameKey.length() > 20) {
                    this.scratchOrgNameKey = this.scratchOrgNameKey.substring(this.scratchOrgNameKey.length() - 20);
                }

            if (options.'scratchOrgUserEmail' && options.'scratchOrgUserEmail' != 'false')
                this.scratchOrgUserEmail = options.'scratchOrgUserEmail' ;
            if (options.'scratchOrgDuration' && options.'scratchOrgDuration' != 'false')
                this.scratchOrgDuration = Integer.valueOf(options.'scratchOrgDuration') ;

            if (options.'packagingOrgAlias' && options.'packagingOrgAlias' != 'false')
                this.packagingOrgAlias = options.'packagingOrgAlias' ;
            if (options.'projectName' && options.'projectName' != 'false') {
                this.projectName = options.'projectName' ;
            }

            if (options.'jsonLog')
                this.jsonLog = true ;

            if (options.'ignoreMyConfigFile')
                this.ignoreOwnConfigFile = true ;

            if (options.'globalKeyPrefix' != '' && options.'globalKeyPrefix' != 'false' && options.'globalKeyPrefix' != false && options.'globalKeyPrefix' != null && options.'globalKeyPrefix' != 'null')
                this.globalKeyPrefix = options.'globalKeyPrefix' ;

            if (options.'sourceEnvName' && options.'sourceEnvName' != 'false')
                this.sourceEnvName = options.'sourceEnvName' ;
            if (options.'devHubName' && options.'devHubName' != 'false')
                this.devHubName = options.'devHubName' ;
            if (options.'workingDir' && options.'workingDir' != 'false')
                this.workingDir = options.'workingDir' ;
            if (options.'packageXmlFile' && options.'packageXmlFile' != 'false')
                this.packageXmlFile = options.'packageXmlFile' ;
            if (options.'additionalPackageXmlFiles' && options.'additionalPackageXmlFiles' != 'false') {
                this.additionalPackageXmlFiles = options.'additionalPackageXmlFiles'.tokenize(',') ;
            }

            if (options.'packagesToInstall' && options.'packagesToInstall' != 'false' &&
             options.'packagesToInstall' != 'null' && options.'packagesToInstall' != null) {
                this.packageList = options.'packagesToInstall'.tokenize(',') ;
            }
            if (options.'themeToProcess' && options.'themeToProcess' != 'false') {
                this.themeToProcess = options.'themeToProcess' ;
            }

            if (options.'apexCodeFile' && options.'apexCodeFile' != 'false')
                this.apexCodeFile = options.'apexCodeFile' ;
            if (options.'exportQuery' && options.'exportQuery' != 'false')
                this.exportQuery = options.'exportQuery'.replace('_PERCENT_','%') ;
            if (options.'exportFolder' && options.'exportFolder' != 'false')
                this.exportFolder = options.'exportFolder' ;
            if (options.'metadatasDeployFolder' && options.'metadatasDeployFolder' != 'false')
                this.metadatasDeployFolder = options.'metadatasDeployFolder' ;
            if (options.'metadatasDeployFolderOutput' && options.'metadatasDeployFolderOutput' != 'false')
                this.metadatasDeployFolderOutput = options.'metadatasDeployFolderOutput' ;
            if (options.'apexCodeFile' && options.'apexCodeFile' != 'false')
                this.apexCodeFile = options.'apexCodeFile' ;
            if (options.'permSetsToAssign' && options.'permSetsToAssign' != 'false') {
                this.permissionSetList = options.'permSetsToAssign'.tokenize(',') ;
            }
            if (options.'userUsername' && options.'userUsername' != 'false')
                this.userUsername = options.'userUsername' ;
            if (options.'userLastName' && options.'userLastName' != 'false')
                this.userLastName = options.'userLastName' ;
            if (options.'userFirstName' && options.'userFirstName' != 'false')
                this.userFirstName = options.'userFirstName' ;
              if (options.'userEmail' && options.'userEmail' != 'false')
                this.userEmail = options.'userEmail' ;

            if (options.'loadMetadatas')
                this.loadMetadatas = true ;

             if (options.'pmdpath' && options.'pmdpath' != 'false')
                this.pmdpath = options.'pmdpath' ;

             if (options.'url' && options.'url' != 'false')
                this.url = options.'url' ;

             if (options.'timeoutInSeconds' && options.'timeoutInSeconds' != 'false')
                this.timeoutInSeconds = Integer.valueOf(options.'timeoutInSeconds')

            if (options.'doNotReuseScratchOrg')
                this.doNotReuseScratchOrg = true ;

            // Kill previous sfdx process if wrongly closed
            if (options.'runFullOrgCreation' &&
                !Utils.systemIsLinux() &&
                Utils.killProcessIfRunning('sfdx.exe'))
            {
                Utils.killProcessIfRunning('node.exe');
                Utils.printlnLog 'Killed process of wrongly closed previous SFDX executions'
            }

            /// RUN SINGLE STEP
            if (options.'runFullOrgCreation') {
                this.createScratchOrgMode = true ;
                this.createAndInitScratchOrg();
                if (!options.'noPush')
                    this.pushSfdxProjectInScratchOrg();
                if (options.'initWithFilteredMetadatas')
                    this.initWithFilteredMetadatas();
                this.assignPermissionSets();
                this.importData();
                this.executeApexCode();
            }
            else if (options.'runPushSfdxProjectToScratchOrg') {
                this.pushSfdxProjectInScratchOrg();
            }
            else if (options.'runPullScratchOrg') {
                this.pullScratchOrg();
            }
            else if (options.'runOpenScratchOrg') {
                this.openScratchOrg();
            }
            else if (options.'runTestClasses') {
                this.executeTestClasses();
            }
            else if (options.'runGeneratePassword') {
                this.generateScratchOrgUserPassword();
            }
            else if (options.'runDeleteScratchOrg') {
                this.deleteScratchOrg(false);
            }
            else if (options.'runDeleteScratchOrgAll') {
                this.deleteScratchOrg(true);
            }
            else if (options.'runFixSfdxProject') {
                this.fixSfdxProject();
            }
            else if (options.'runAssignPermissionSets'){
                this.assignPermissionSets();
            }
            else if (options.'runApexCode'){
                this.executeApexCode();
            }
            else if (options.'runTestCase'){
                this.runTestCase();
            }
            else if (options.'runAutomatedTestingToolScratch'){
                this.runAutomatedTestingToolOnScratch();
            }
            else if (options.'runPushSFDXProjectInScratchOrg') {
                this.pushSfdxProjectInScratchOrg();
            }
            else if (options.'runConvertSfdxProjectToMetadata') {
                this.convertSfdxProjectToMetadata();
                this.fixMetadatasBeforeDeploy();
                this.filterMetadatasBeforeDeploy()
            }
            else if (options.'runDeploySfdxProjectToSourceEnv') {
                this.deploySfdxProjectToSourceEnv();
            }
            else if (options.'runScratchUserCreation'){
                this.createScratchOrgUser();
            }
            else if (options.'runExportData'){
                this.exportData();
            }
            else if (options.'runImportData'){
                this.importData();
            }
            else if (options.'runSassProcessing'){
                this.sassProcessing();
            }
            else if (options.'runListAllOrgs') {
                this.listAllOrgs();
            }
            else if (options.'runListDevHubActiveScratchOrgs') {
                this.listDevHubActiveScratchOrgs();
            }
            else if (options.'runCreateNewSFDXProjectWithSourceEnvMetadatas') {
                this.manageSelectSFDXProject();
                this.retrieveSourceOrgMetadata();
                this.convertMetadataToSfdxProject();
            }
            else if (options.'runRetrieveSourceOrgMetadata') {
                this.promptForReloadMetadatas = false
                this.retrieveSourceOrgMetadata();
            }
            else if (options.'runGenerateManagedPackage') {
                this.generateManagedPackage();
            }
            else if (options.'runCheckCodeConsistency') {
                this.checkCodeConsistency();
            }
            else if (options.'runCheckPackageConsistency') {
                this.checkPackageConsistency();
            }
            else if (options.'runWaitCommunityActive') {
                this.waitCommunityActive();
            }

            if (this.jsonLog == true) {
                Utils.printlnLog(Utils.toJsonStringFlat(this.jsonLogContent)) ;
            }

        }

        /////////////////////// RUN CREATE ORG ////////////////////////
        public createAndInitScratchOrg() {
            // Connect DevHub org
            this.manageConnectOrg(this.devHubName);

            // Create or select SFDX Project
            this.manageSelectSFDXProject();

            // Get metadata from source org if necessary
            if (this.loadMetadatas == true)
                this.retrieveSourceOrgMetadata();

            // Process creation of the scratch org
            this.createNewScratchOrg()

            // Install additional packages
            this.installAdditionalPackages()

            def runCreateOrgResult = true ;
            assert runCreateOrgResult == true,  "[ERROR] RUN CREATE ORG failed"
            return true ;
        }

        /////////////////////// Project Creation ////////////////////////////////
        public manageSelectSFDXProject() {

            // Project not selected. Request selection or creation
            if (this.projectName == null) {
                def elpse = Utils.startElapse('SFDX Project Selection or Creation')
                def ok = true ;

                def userSlctdDir = null ;
                if (Utils.listDirectories(this.projectDir).size() > 0)
                    userSlctdDir = Utils.userSelectDirectory('Select an existing SFDX Project ,or click cancel to create a new one',this.projectDir);
                // User selected a SFDX Project
                if (userSlctdDir != null)
                    this.projectName = userSlctdDir.getName();
                else
                {
                    // User wants to create a SFDX Project
                    this.projectName = Utils.userInputText('Please enter the name of the Salesforce DX Project to create (without spaces or special characters): ', 5)
                    this.manageConnectOrg(this.devHubName);
                    Utils.checkCreateDir(this.projectDir);
                    def projCreationCommand ='sfdx force:project:create -n '+this.projectName;
                    def projCreationCommandResult = Utils.executeCommand(projCreationCommand, 'Create new SFDX Project',this.projectDir);
                    assert projCreationCommandResult == true,  "[ERROR] Unable to create SFDX Project"
                }

                this.currentProjectPath = './'+this.projectDir+'/'+this.projectName ;

                Utils.stopElapse(elpse);
                assert ok == true,  "[ERROR] Project Selection or Creation failed"
                return ok ;
            }
            // Project name is sent from INI but has not been generated
            else if (this.projectName != null && !new File('./'+this.projectDir+'/'+this.projectName+'/config').exists()) {
                this.manageConnectOrg(this.devHubName);
                Utils.checkCreateDir(this.projectDir);
                def projCreationCommand ='sfdx force:project:create -n '+this.projectName;
                def projCreationCommandResult = Utils.executeCommand(projCreationCommand, 'Create new SFDX Project',this.projectDir);
                this.currentProjectPath = './'+this.projectDir+'/'+this.projectName ;
                assert projCreationCommandResult == true,  "[ERROR] Unable to create SFDX Project"
            }
            else {
                this.currentProjectPath = './'+this.projectDir+'/'+this.projectName ;
                return true ;
            }


        }

        public manageConnectOrg(String alias) {

            // Check if this script already connected to this org
            if (this.connectedOrgsAliasList.contains(alias))
                return true ;

            // List connected orgs
            def forceOrgListResult = this.forceOrgList();
            Boolean isConnected = false

            if ( forceOrgListResult != null && forceOrgListResult.status == 0 && forceOrgListResult.result.nonScratchOrgs != null) {
                // Append classic orgs and scratch orgs
                def nonScratchOrgs = forceOrgListResult.result.nonScratchOrgs ;
                def orgsToIterate = nonScratchOrgs
                if (forceOrgListResult.result.scratchOrgs != null)
                    orgsToIterate.addAll(forceOrgListResult.result.scratchOrgs)
                // Check if the org alias is connected
                for (org in orgsToIterate) {
                        // Alias org is connected
                        if ( org.alias == alias && (org.connectedStatus == 'Connected' || org.connectedStatus == 'Unknown')) {
                            isConnected = true ;
                            Utils.printlnLog 'Alias '+alias+' is already connected:'
                            //Utils.printlnLog org ;
                            // Display warning is connected status == Unknown
                            if (org.connectedStatus == 'Unknown') {
                                Utils.printlnLog 'WARNING: '+alias+' connexion status is "Unknown", let\'s assume it is connected until SFDX bug is corrected'
                            }
                            // If alias is dev hub & not defined as defaultdevhub, set it
                            if ( alias == this.devHubName && !(org.isDefaultDevHubUsername == true)) {
                                def defaultHubSetCommand = 'sfdx force:config:set defaultdevhubusername='+this.devHubName+' --global';
                                def defaultHubSetCommandResult = Utils.executeCommand(defaultHubSetCommand,
                                                      'Set '+this.devHubName+' as default dev hub username');
                            }
                        }
                };
            }

            // If not connected, try to connect using JWT flow
            if (isConnected == false) {

                // Automatic login using JWT Flow
                // ssl folder must contain ORGALIAS.json, ORGALIAS.crt and ORGALIAS.key
                // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm
                def projectPath = './'+this.projectDir+'/'+this.projectName ;
                def sslDefFilePath = projectPath+'/ssl/'+alias+'.json' ;
                def sslDefFile = new File(sslDefFilePath);
                def forceAuthPath = projectPath ;
                // If SSL stuff is not in Projects/ProjectName/SSL, use root /ssl folder
                if (!sslDefFile.exists()) {
                    sslDefFile = new File('./ssl/'+alias+'.json')
                    forceAuthPath = '.'
                }
                Utils.printlnLog("Not connected: trying JWT using "+sslDefFilePath)
                if (sslDefFile.exists()) {
                    Utils.printlnLog('Found SSL Definition for '+alias);
                    def sslParams = Utils.fromJsonString(sslDefFile.text) ;
                    def grantCommand = 'sfdx force:auth:jwt:grant --clientid '+sslParams['clientId']+' --jwtkeyfile ./ssl/'+alias+'.key --username '+sslParams['username']+' --setalias '+alias ;
                    if (alias == this.devHubName)
                        grantCommand+= ' --setdefaultdevhubusername' ;
                    def grantCommandResult = Utils.executeCommand(grantCommand,'Grant access to '+alias+' using JWT flow',forceAuthPath);
                    isConnected = grantCommandResult ;
                }
                else {
                    Utils.printlnLog(sslDefFile.toString()+" JWT def not found, so try manual login (works only on Windows)");
                }
            }

            // If alias org still not connected, connect to it manually
            if (isConnected == false && System.properties['os.name'].toLowerCase().contains('windows')) {

                // Show list orgs result for debugging purposes
                Utils.printlnLog 'List orgs results was :\n'+forceOrgListResult+'\n' ;

                // Manual login using force:auth:web:login
                def loginCommand = 'sfdx force:auth:web:login -d -a '+alias ;
                def loginCommandResult = Utils.executeCommand(loginCommand,
                                                  'Please Login into your '+alias+' org');
                Utils.printlnLog 'Please login in your '+alias+' org in Web Browser' ;
            }

            if  (isConnected == true) {
                this.connectedOrgsAliasList << alias ;
            }
        }

        ///////////////////////// Scratchorg Creation ////////////////////// !!! not tested >>move to utils ??
        public createNewScratchOrg() {

            def elpse = Utils.startElapse('Scratchorg Creation')

            this.manageSelectScratchOrg(true);

            def sfdxProjectPath = './'+this.projectDir+'/'+this.projectName ;
            def ok = true ;
            try {

                // Check if there is not an existing scratch org with same name
                def scratchOrgList = this.listAllScratchOrgs();
                Utils.printlnLog('Found existing scratch orgs list :');
                Utils.printlnLog(scratchOrgList);
                Boolean existingScratchOrg = false ;
                if (scratchOrgList != null && this.doNotReuseScratchOrg == false) {
                    for (def org in scratchOrgList) {
                        if (org.alias  == this.scratchOrgAlias)
                            existingScratchOrg = true ;
                    }
                }

                if (existingScratchOrg == false) {
                    // Create scratch org command
                    def orgCreationCommand = 'sfdx force:org:create --setdefaultusername --definitionfile=\"./config/'+this.projectScratchDefName+'\" --setalias='+this.scratchOrgAlias+' -d '+this.scratchOrgDuration+' --targetdevhubusername='+this.devHubName + ' --json';
                    def orgCreationCommandResult = Utils.executeCommand(orgCreationCommand, 'Create new scratch org', sfdxProjectPath);
                    Utils.printlnLog('Base scratch org has been created using /config/'+this.projectScratchDefName);
                    def orgCreationCommandLog = Utils.getCommandLogAsObj(orgCreationCommand) ;
                    this.jsonLogContent['scratchOrgCreated'] = orgCreationCommandLog ;
                    this.jsonLogContent['scratchOrgAliasCreated'] = this.scratchOrgAlias ;

                    assert orgCreationCommandResult == true,  "[ERROR]  Unable to create scratch org. Probably a SFDC platform issue, please try again"
                    // Example of correct scratch org creation log:  {"status":0,"result":{"orgId":"00D9E0000008jzXUAQ","username":"nvuillam@jenkins_nvuillam_822837048-dxc-scratch.com"}}
                    assert orgCreationCommandLog.status == 0, "[ERROR]  Unable to create scratch org. Probably a SFDC platform issue, please try again"
                    this.scratchHasJustBeenCreated = true;
                    this.sourceEnvName = this.scratchOrgAlias ;
                    this.forceOrgListCache = null // reset force:org:list cache

                    this.generateScratchOrgUserPassword();

                    // Change default user last name and first name
                    def usrLastNameToUse = (this.userLastName != null)?this.userLastName:this.defaultUserLastName
                    def usrFirstNameToUse = (this.userFirstName != null)?this.userFirstName:this.defaultUserFirstName
                    def countryToUse = (this.userCountry != null)?this.userCountry:this.defaultUserCountry
                    def usrUpdateNameCommand = "sfdx force:data:record:update -s User -w \"Name='User User'\" -v \"LastName='"+usrLastNameToUse+"' FirstName='"+usrFirstNameToUse+"' Country='"+countryToUse+"'\""
                    def usrUpdateNameCommandResult = Utils.executeCommand(usrUpdateNameCommand, 'Update admin user last name and first name', sfdxProjectPath);

                }
                else
                    Utils.printlnLog('Scratch org '+this.scratchOrgAlias+ ' is already existing and will be reused for this script execution.')

                // Open scratch org command if not headless environment
                if (!Utils.systemIsLinux()) {
                    def orgOpenCommand = 'sfdx force:org:open -u '+this.scratchOrgAlias;
                    def orgOpenCommandResult = Utils.executeCommand(orgOpenCommand,'Open new scratch org');
                    assert orgOpenCommandResult == true,  "[ERROR]  Unable to open scratch org"
                }

            } catch (Exception e) {
                Utils.printlnLog ('Error while creating scratch org +\n'+e.getMessage() + '\n' + e.getStackTrace()) ;
                ok = false ;
            }

            Utils.stopElapse(elpse);
            assert ok == true,  "[ERROR]  create & open scratch org failed"
            return ok ;
        }

        // Generate password for user (until it does not contain a boring character)
        public generateScratchOrgUserPassword() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            Boolean pwdOk = false
            while (pwdOk == false) {
                def orgPwdCommand = 'sfdx force:user:password:generate -u '+this.scratchOrgAlias +' --json';
                def orgPwdCommandResult = Utils.executeCommand(orgPwdCommand,'Generate password for main scratch org user');
                def orgPwdCommandLog = Utils.getCommandLogAsObj(orgPwdCommand) ;
                this.jsonLogContent['scratchOrgUserCreated'] = orgPwdCommandLog ;
                def pwd = orgPwdCommandLog.result.password
                this.jsonLogContent['scratchOrgPassword'] = pwd ;
                def boringCharsForCommandLine = ['$','&','@'] //['%','^','"','\\','|','\'','-','$','@'] //NV: now we use strong quotes to call Dxc Player, it should be ok
                if (!Utils.stringContainsOneOf(pwd,boringCharsForCommandLine)) {
                    pwdOk = true
                    Utils.printlnLog("New password for scratch org ${this.scratchOrgAlias} main user : ${pwd}")
                    Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_pwd",pwd)
                }
                else
                    Utils.printlnLog('Ugly: Password not compliant with DXC Player: generate another')
            }
        }

        public createScratchOrgUser() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            def elpse = Utils.startElapse('User Creation')

            this.userDefJsonCreation();

            def scratchOrgConfigPath = './'+this.projectDir+'/'+this.projectName+'/config' ;

            def usrCreationCommand = 'sfdx force:user:create --definitionfile=project-user-def.json -u '+this.scratchOrgAlias;
            def usrCreationCommandResult = Utils.executeCommand(usrCreationCommand, 'Create new user '+this.userUsername+' in scratch org '+this.scratchOrgAlias, scratchOrgConfigPath);

            def usrDisplayCommand = 'sfdx force:user:display -u '+this.userUsername;
            Utils.executeCommand(usrDisplayCommand, 'Display user info');

            Utils.stopElapse(elpse);
            assert usrCreationCommandResult == true,  "[ERROR]  Unable to create scratch org"
        }

        ///////////////////////// JSON Definition file creation/////////
        public defJsonCreation() {
            def orgName = this.scratchOrgAlias ;
            if (orgName == null && this.scratchOrgUserEmail == null)
                orgName = this.projectName ;

            // if email set, generate random names
            if (this.scratchOrgUserEmail != null) {
                def userId1 = Utils.substringBefore(this.scratchOrgUserEmail,'@');
                if (this.scratchOrgNameKey)
                    orgName = 'jenkins_'+this.scratchOrgNameKey.replace('.','_')+'_'+String.valueOf((int)(Math.random()*1000000000))
                else
                    orgName = 'jenkins_'+userId1.replace('.','_')+'_'+String.valueOf((int)(Math.random()*1000000000))
                this.scratchOrgAlias = orgName ;
                this.userUsername = userId1+'@'+orgName+'-'+this.usernameSuffix ;
                this.userEmail = this.scratchOrgUserEmail
            }
            if (orgName == null)
                orgName = 'DefaultOrgNameNotCool' ;

            if (this.userUsername == null) {
                def userBase = Utils.userInputText('Please enter the name of the user to create (ex: nvuillamy)', 5);
                this.userUsername = userBase+'@'+orgName.toLowerCase()+'-'+this.usernameSuffix ;
                Utils.printlnLog('Username will be: '+this.userUsername);
            }
            if (this.userEmail == null) {
                this.userEmail = Utils.userInputText('Please enter the e-mail of the user to create (ex: nvuillam@dxc.com)', 5);
            }

            this.jsonLogContent['scratchOrgUsername'] = this.userUsername

            // Read & parse project-scratch-def.json
            def defaultProjectConfigFileName = 'project-scratch-def.json';
            this.projectScratchDefName = 'project-scratch-def-'+this.scratchOrgAlias+'.json' ;
            Utils.copyFile("./"+this.projectDir+"/"+this.projectName+"/config/"+defaultProjectConfigFileName,
                            "./"+this.projectDir+"/"+this.projectName+"/config/"+this.projectScratchDefName);


            def projectConfigFile = new File("./"+this.projectDir+"/"+this.projectName+"/config/"+this.projectScratchDefName);
            def jsonProjectConfigMap = Utils.fromJsonString(projectConfigFile.text)

            // Add user input parameters in config file
            jsonProjectConfigMap['orgName'] = orgName
            jsonProjectConfigMap['username'] = this.userUsername
            jsonProjectConfigMap['adminEmail'] = this.userEmail

            // Write updated Json in project-scratch-def.json
            def jsonProjectConfigJsonString = Utils.toJsonString(jsonProjectConfigMap);
            projectConfigFile.text = jsonProjectConfigJsonString ;

            Utils.printlnLog 'Updated  '+projectConfigFile.getAbsolutePath()+ ' with content :';
            Utils.printlnLog projectConfigFile.text ;
            return true ;
        }

        /////////////////////////User JSON Definition file creation///////// !!! not tested
        public userDefJsonCreation() {

            if (this.userUsername == null) {
                def userBase = Utils.userInputText('Please enter the name of the user to create (ex: nvuillamy)', 5);
                this.userUsername = userBase+'@'+this.scratchOrgAlias.toLowerCase()+'-'+this.usernameSuffix ;
                Utils.printlnLog('Username will be: '+this.userUsername);
            }
            if (this.userLastName == null) {
                this.userLastName = this.userUsername ;
            }
            if (this.userEmail == null) {
                this.userEmail = Utils.userInputText('Please enter the e-mail of the user to create (ex: nvuillam@dxc.com)', 5);
            }

            // Read & parse project-user-def.json
            def userConfigFileName = 'project-user-def.json';
            def userConfigFile = new File("./"+this.projectDir+"/"+this.projectName+"/config/"+userConfigFileName);
            def jsonUserConfigMap = Utils.fromJsonString(userConfigFileName.text)

            // Add user input parameters in config file
            jsonUserConfigMap['permsets'] = permissionSetList
            jsonUserConfigMap['Username'] = this.userUsername
            jsonUserConfigMap['LastName'] = this.userLastName
            jsonUserConfigMap['Email'] = this.userEmail

            // Write updated Json in project-user-def.json
            def jsonUserConfigJsonString = Utils.toJsonString(jsonUserConfigMap);
            userConfigFile.text = jsonUserConfigJsonString ;

            Utils.printlnLog 'Updated  '+userConfigFile.getAbsolutePath()+ ' with content :';
            Utils.printlnLog userConfigFile.text ;

            return true ;
        }

        /////////////////////// Install external packages ////////////////////////////////
        public installAdditionalPackages() {
            if (this.packageList == null || this.packageList.size() == 0)
                return ;
            this.manageSelectSFDXProject();
            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;

            def elpse = Utils.startElapse('Install additional packages')
            def pckgInstallRes = false

            Utils.printlnLog 'Packages to install :'+packageList

/*            // Ask user to perform manual actions // NV: not needed anymore
            def manualActionsText = '''
SETUP manual actions:
- Account settings: Enable the check-box \"Allow users to relate a contact to multiple accounts\"
- State and Country Picklists: Click 2: Scan, then click 3: Convert (select any value, you don\'t care), then click on Finish and Enable
- Deployment settings: Check \"Allow deployments of components when corresponding Apex jobs are pending or in progress\".

VALIDATE ONLY WHEN ALL ACTIONS ARE DONE to allow the script to continue
''' ;
            Utils.userPromptOkCancel(manualActionsText, 'Manual actions to perform in the scratch org', 5); */

            // In case this is a brand new scratch, some options must be checked
            if (this.scratchHasJustBeenCreated) {
                String checkAndSetupText = '''
 _____                           _              _     _
|_   _|                         | |            | |   | |
  | | _ __ ___  _ __   ___  _ __| |_ __ _ _ __ | |_  | |
  | || '_ ` _ \\| '_ \\ / _ \\| '__| __/ _` | '_ \\| __| | |
 _| || | | | | | |_) | (_) | |  | || (_| | | | | |_  |_|
 \\___/_| |_| |_| .__/ \\___/|_|   \\__\\__,_|_| |_|\\__| (_)
               | |
-=-=-=-=-=-=-=-|_|-=-= To do during package installation =-=-=-=-=-=-=-=-=-=-=-
(Only DXC OmniChannel for Salesforce related)
Please CHECK & eventualy SETUP the following options :
 - Deployment settings :           \"Allow deployments of components when corresponding Apex jobs are pending or in progress\" must be checked.
-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
''';
                Utils.printlnLog(checkAndSetupText); // nonblocking message. We have time to check the options during package installation
            }
            // List already installed packages
            def alreadyInstalledPackageList = this.listOrgInstalledPackages(this.scratchOrgAlias);
            Utils.printlnLog('The following package list is already installed :\n'+Utils.toJsonString(alreadyInstalledPackageList))

            def justInstalledPackageIds = []

            def configPackages = Utils.getPropInJsonFile(this.sharedConfigFile,"packages")

            for (String packageIdLabel: this.packageList) {
                def packageId = null
                def packageLabel = null
                def packageConfigDef = null

                if (packageIdLabel.contains('#')) {
                    // Get packageId from command line arguments
                    packageId = Utils.substringBefore(packageIdLabel,'#')
                    // In case package is an URL, call it then retrieve the package id in its result
                    if (packageId.startsWith('http')) {
                        packageId = UtilsSFDC.getPackageIdFromUrl(packageId)
                    }
                    packageLabel = Utils.substringAfter(packageIdLabel,'#')
                }
                else {
                    // Get packageId from sharedConfig.ini
                    packageLabel = packageIdLabel ;
                    packageConfigDef = configPackages[packageLabel]
                    assert packageConfigDef != null , 'ERROR: '+packageLabel+' not found in '+this.sharedConfigFile+' configPackages:'+configPackages
                    packageId = packageConfigDef.id ;
                }

                def installPckgFlag = true

                // If package is already installed, try to mach with config and if not found, ask user if he wants to reinstall it
                if (alreadyInstalledPackageList != null && alreadyInstalledPackageList.size() > 0) {
                    def askUserForPckgInstall = true
                    alreadyInstalledPackageList.each { installedPkg ->
                        if ( (packageConfigDef.namespacePrefix != null && packageConfigDef.namespacePrefix == installedPkg['NamespacePrefix']) ||
                            (packageConfigDef.publisherName != null && packageConfigDef.publisherName == installedPkg['Name']) ) {
                            installPckgFlag = false
                            askUserForPckgInstall = false
                            Utils.printlnLog ('Skip installation of '+packageLabel+' as it is already installed');
                        }
                    }

                    if (askUserForPckgInstall == true && packageConfigDef == null)
                        installPckgFlag = Utils.userPromptOkCancel('Do you want to install package '+packageLabel+' ('+packageId+') ?');
                }
                if (justInstalledPackageIds.contains(packageId)) {
                    Utils.printlnLog ('Skip installation of '+packageId+' as it has just been installed. You may have a config issue');
                }
                // install package
                else if (installPckgFlag == true) {
                    def installPackgCommand = 'sfdx force:package:install --package '+packageId+' -u '+this.scratchOrgAlias+' --noprompt --securitytype AllUsers -w 30' ;
                    pckgInstallRes = Utils.executeCommand(installPackgCommand,
                                              'Installing package '+packageLabel+' ('+packageId+')', sfdxWorkingDir);
                    assert pckgInstallRes == true , 'Package installation failure: '+packageLabel+' ('+packageId+')'
                    justInstalledPackageIds << packageId
                }
            }

            Utils.stopElapse(elpse);
            return true ;
        }

        ///////////////////// GET SOURCE ORG METADATA ////////////////////////////////////
        public retrieveSourceOrgMetadata() {
            this.manageSelectSFDXProject()
            this.manageConnectOrg(this.sourceEnvName);

            def elpse = Utils.startElapse('Retrieve source org Metadatas for SFDX Project')

            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;
            def mdApiFldr = this.metadatasDeployFolder ;
            def mdApiZipFldr = 'mdapipkg'
            def doRetrieve = false ;
            def retrieveDataForSFDX = false ;

            if (new File(sfdxWorkingDir+'/.sfdx').exists() && this.promptForReloadMetadatas == true )
                doRetrieve = Utils.userPromptOkCancel('Metadatas already existing in local project.\nDo you want to fetch them again ? (if you don\'t know, input N)', 5);
            else
                doRetrieve = true ;

            if (doRetrieve == true) {
                def retrieveFldrName = './mdapipkg' ;
                Utils.checkCreateDir(sfdxWorkingDir+'/'+retrieveFldrName);
                Utils.printlnLog ('Directory to receive metadatas: '+sfdxWorkingDir+'/'+retrieveFldrName);
                Utils.printlnLog ('Create local package.xml file from packageXmlFile sent as argument ('+this.packageXmlFile+')');
                Utils.copyFile(this.packageXmlFile,sfdxWorkingDir+'/package.xml');

                retrieveDataForSFDX = Utils.executeCommand('sfdx force:mdapi:retrieve -r '+retrieveFldrName+' -u '+this.sourceEnvName+' -k ./package.xml',
                                                                'Retrieve metadatas ', sfdxWorkingDir);

                /* NV: not working def retrieveDataForSFDXreport = Utils.executeCommand('sfdx force:mdapi:retrieve:report',
                                                                'Request retrieve report', sfdxWorkingDir); */

                if (retrieveDataForSFDX == true /*&& retrieveDataForSFDXreport == true */)
                    Utils.killFile(sfdxWorkingDir+'/package.xml');

                // Unzip retrieve metadata file
                Utils.checkCreateDir(sfdxWorkingDir+'/'+mdApiFldr);
                Utils.printlnLog ('Unzipping MDAPI metadatas from' +sfdxWorkingDir+'/'+mdApiZipFldr+'/unpackaged.zip to '+sfdxWorkingDir+'/'+mdApiFldr);
                def antForZip = new AntBuilder();
                antForZip.unzip(src: sfdxWorkingDir+'/'+mdApiZipFldr+'/unpackaged.zip',dest: sfdxWorkingDir+'/'+mdApiFldr,overwrite:"true" )
                // Copy package.xml into unzipped folder
                Utils.copyFile(this.packageXmlFile,sfdxWorkingDir+'/'+mdApiFldr+'/unpackaged/package.xml');

                // Delete zip file
                def delZipFile = Utils.killDir('./'+this.projectDir+'/'+this.projectName+'/'+mdApiZipFldr);

            }

            Utils.stopElapse(elpse);
            if (doRetrieve == true)
                assert retrieveDataForSFDX == true ,  "[ERROR] retrieveSourceOrgMetadata failed"
            return true ;
        }



        public convertMetadataToSfdxProject() {
                def elpse = Utils.startElapse('Convert Metadatas into SFDX format')

                if (this.scratchOrgAlias)
                   this.refactorUnpackagedMetadatas()

                def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;
                def mdApiFldr = this.metadatasDeployFolder ;

                // Convert metadata in SFDX format
                def dataConvertCommand = 'sfdx force:mdapi:convert -r '+mdApiFldr+' --loglevel=warn ' ;
                def dataConvertCommandResult = Utils.executeCommand(dataConvertCommand,
                                                  'Convert MDAPI metadatas to SFDX Project',
                                                   sfdxWorkingDir);
                assert dataConvertCommandResult == true,  "[ERROR] Convert Metadatas into SFDX format failed"

                this.fixSfdxProject()

                Utils.stopElapse(elpse);
        }

        /////////////////////// Code Push ////////////////////////////////  !!! not tested  >>move to utils ??
        public pushSfdxProjectInScratchOrg() {
            def elpse = Utils.startElapse('Push SFDX Project in scratch org')

            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            // Check if test not already succeded ( in the case do not run again)
            if (Utils.getExternalValue(this.globalKeyPrefix,'scratchPush_'+this.scratchOrgAlias) == 'success' && this.globalKeyPrefix != null) {
                Utils.printlnLog('Skip push in '+this.scratchOrgAlias+' already performed for global key '+this.globalKeyPrefix);
                Utils.stopElapse(elpse);
                return true;
            }

            // Fix metadatas only at the scratch org creation, not at intermediary pushes
            if (this.createScratchOrgMode == true) {
                 fixMetadataBeforePushToScratchOrg();
             }

            def dataPushCommand = 'sfdx force:source:push -g -w 60 --forceoverwrite -u '+this.scratchOrgAlias;
            def dataPushCommandResult = Utils.executeCommand(dataPushCommand,
                                              'Push SFDX Project in '+this.scratchOrgAlias, './'+this.projectDir+'/'+this.projectName);
            if (dataPushCommandResult == true && this.globalKeyPrefix != null) {
                Utils.setExternalValue(this.globalKeyPrefix,'scratchPush_'+this.scratchOrgAlias, 'success');
            }
            Utils.printlnLog('dataPushCommandResult: '+dataPushCommandResult)
            Utils.stopElapse(elpse);
            //assert dataPushCommandResult == true,  "[ERROR] SFDX Project push failed"
            return true ;
        }

        // Initialize a scratch org with filtered metadatas
        public initWithFilteredMetadatas() {
            def prevMetadatasDeployFolder = this.metadatasDeployFolder
            def prevMetadatasDeployFolderOutput = this.metadatasDeployFolderOutput

            // Main package.xml file
            if (this.packageXmlFile != null) {

                // Check if deploy not already succeded ( in the case do not run again)
                if (Utils.getExternalValue(this.globalKeyPrefix,'scratchDeploy_'+this.scratchOrgAlias+'-'+this.packageXmlFile) == 'success' && this.globalKeyPrefix != null) {
                    Utils.printlnLog('Skip deploy in '+this.scratchOrgAlias+' already performed for global key '+this.globalKeyPrefix);
                }
                else {
                    this.sourceEnvName = this.scratchOrgAlias ;
                    this.convertSfdxProjectToMetadata();
                    this.fixMetadatasBeforeDeploy();
                    this.filterMetadatasBeforeDeploy();
                    this.metadatasDeployFolder = this.metadatasDeployFolderOutput ;
                    this.deploySfdxProjectToSourceEnv();
                }
            }

            // Deploy additional package.xml files
            if (this.additionalPackageXmlFiles.size() > 0) {
                Utils.printlnLog('\n### Deploying additional package.xml files ###\n')
                def initialPackageXmlFile = this.packageXmlFile
                this.additionalPackageXmlFiles.each{ String addlPackgXmlFile ->
                    Utils.printlnLog('-- Deploying '+addlPackgXmlFile+' ...')
                    // Check if deploy not already succeded ( in the case do not run again)
                    if (Utils.getExternalValue(this.globalKeyPrefix,'scratchDeploy_'+this.scratchOrgAlias+'-'+addlPackgXmlFile) == 'success' && this.globalKeyPrefix != null) {
                        Utils.printlnLog('Skip deploy in '+this.scratchOrgAlias+' already performed for global key '+this.globalKeyPrefix);
                    }
                    else {
                        this.sourceEnvName = this.scratchOrgAlias ;
                        this.packageXmlFile = addlPackgXmlFile;
                        this.metadatasDeployFolder = prevMetadatasDeployFolder
                        this.metadatasDeployFolderOutput = prevMetadatasDeployFolderOutput
                        this.convertSfdxProjectToMetadata();
                        this.fixMetadatasBeforeDeploy();
                        this.filterMetadatasBeforeDeploy();
                        this.metadatasDeployFolder = this.metadatasDeployFolderOutput ;
                        this.deploySfdxProjectToSourceEnv();
                    }
                }
                this.packageXmlFile = initialPackageXmlFile
            }
            this.metadatasDeployFolder = prevMetadatasDeployFolder
            this.metadatasDeployFolderOutput = prevMetadatasDeployFolderOutput


        }

        ///////////////// Change dependency of local items to external packages ////////////////////
        public refactorUnpackagedMetadatas(){

            this.manageSelectScratchOrg(false);
            // Get package number with SOQL query, then update metadatas to match dependencies with this version number
            def installedPackageList = this.listOrgInstalledPackages(this.scratchOrgAlias);

            String target = './'+this.projectDir+'/'+this.projectName+'/mdapi/unpackaged'
            File folder = new File(target);
            assert folder.exists() , "[ERROR] retrieve folder not found" ;
            def updates = 0 ;
            folder.eachFileRecurse (FileType.FILES) { file ->
                String ext = Utils.getFileExtension(file.getName());
                if (ext.equals("xml") || ext.equals("object")) {
                    def fileText ='';
                    def lines = file.readLines();
                    def linesPos = 0 ;
                    lines.each { String line ->

                        installedPackageList.each { packageDescription ->
                            def nsPrefix = packageDescription['NamespacePrefix'];
                            if (line.contains('<majorNumber>') && nsPrefix != null ) {
                                def linePosPlus2 = linesPos+2 ;
                                if (lines[linePosPlus2] != null && lines[linePosPlus2].contains( nsPrefix) &&
                                     !line.contains('<majorNumber>' + packageDescription['MajorVersion'] + '</majorNumber>')) {
                                    line = '        <majorNumber>' + packageDescription['MajorVersion'] + '</majorNumber>' ;
                                    updates ++
                                    Utils.printlnLog('- Updated '+file.getName()+' with: '+line+' ('+nsPrefix+')');
                                   }
                            }
                            else if (line.contains('<minorNumber>') && nsPrefix != null ){
                                def linePosPlus1 = linesPos+1 ;
                                if (lines[linePosPlus1] != null && lines[linePosPlus1].contains( nsPrefix) &&
                                     !line.contains('<minorNumber>' + packageDescription['MinorVersion'] + '</minorNumber>')) {
                                    line = '        <minorNumber>' + packageDescription['MinorVersion'] + '</minorNumber>' ;
                                    updates++ ;
                                    Utils.printlnLog('- Updated '+file.getName()+' with: '+line+' ('+nsPrefix+')');
                                }
                            }

                        }
                        fileText = fileText + line + "\n"
                        linesPos++ ;
                    }
                    file.write(fileText);
                }
            }
            Utils.printlnLog('Updated '+updates+' files while browsing');
            return updates ;
        }


        // Fix SFDX project until SFDX install a debug patch
        public fixSfdxProject() {

            def elpse = Utils.startElapse('Fix SFDX Project (SFDX bug workaround)')

            this.manageSelectSFDXProject();

            // Kill External packages *object-meta.xml
            String target = './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder+'/objects'
            File targetFile = new File(target);
            def deletedMetaXmlList = [];
            assert targetFile.exists() , "[ERROR] retrieve folder not found" ;
            targetFile.eachFileRecurse () { file ->
                String currentFileName = file.getName();
                if (currentFileName =~ /(ExternalPackage).*(.object-meta.xml)/) {
                    deletedMetaXmlList << currentFileName.getName();
                    Utils.killFile (currentFileName);
                }
            }

            Utils.printlnLog 'Deleted files: '+deletedMetaXmlList ;

            // Update sourcePathInfos
            new AntBuilder().fileScanner {
                fileset(dir: './'+this.projectDir+'/'+this.projectName, includes: '**/sourcePathInfos.json')
            }.each { File f ->

                    def removedList = [] ;
                    def fileText = f.text ;
                    def slurper = new JsonSlurper()
                    def sourcePathItemList = slurper.parseText(fileText);
                    def sourcePathItemListResult = [];
                    for (sourcePathItemArray in sourcePathItemList) {
                        def sourcePathItemKey = sourcePathItemArray[0];
                        def sourcePathItem = sourcePathItemArray[1];
                        boolean addIt = true ;
                        if (sourcePathItem.sourcePath) {
                            def sourcePathItemFileName = Utils.substringAfterLast(sourcePathItem.sourcePath,'\\') ;
                            if (deletedMetaXmlList.contains(sourcePathItemFileName)) {
                                addIt = false ;
                                removedList << sourcePathItemFileName
                            }

                        }
                        if (addIt == true)
                            sourcePathItemListResult << sourcePathItemArray ;
                    }
                    Utils.printlnLog 'Removed sourcePathInfos.json references: '+removedList ;

                    def jsonBld = new JsonBuilder(sourcePathItemListResult);
                    f.text = jsonBld.toString();
            }
            def labelCorrection = true ;
            Utils.stopElapse(elpse);
            assert labelCorrection == true,  "[ERROR] label Correction failed"
            return true ;
        }

        // Assign permission sets to a user
        public assignPermissionSets() {
            if (this.permissionSetList != null && permissionSetList.size() > 0) {
                def elpse = Utils.startElapse('Assign permission sets') ;

                this.manageSelectScratchOrg(false);

                def orgInfo = this.getOrgInfo(this.scratchOrgAlias);
                def usernm = orgInfo.username ;

                def usrInfo = this.getUserInfo(usernm);

                this.permissionSetList.each { permSetName ->
                    def permSetAssgnCommand = 'sfdx force:user:permset:assign -n '+permSetName+' -u '+usernm;
                    def permSetAssgnCommandResult = Utils.executeCommand(permSetAssgnCommand, 'Assign permset '+permSetName+' to '+usernm+' in org '+this.scratchOrgAlias);
                }
                Utils.stopElapse(elpse);
            }
        }

        public executeSingleApexCodeFile(def singleFile) {
            def prevApexCodeFile = this.apexCodeFile
            this.apexCodeFile = singleFile ;
            this.executeApexCode();
            this.apexCodeFile = prevApexCodeFile ;
        }

        // Execute apex code stored in a file sent as parameter
        public executeApexCode() {
            if (this.apexCodeFile != null ) {

                def elpse = Utils.startElapse('Execute apex code') ;

                this.manageSelectScratchOrg(false);
                this.manageConnectOrg(this.scratchOrgAlias);

                // Parameters can be file folder ( all .apex files in the list will be executed )
                def file = new File(this.apexCodeFile);
                def fileList = [] ;
                if (file.isDirectory()) {
                     new AntBuilder().fileScanner {
                            fileset(dir: this.apexCodeFile, includes: '**/**.apex')
                       }.each { File f ->
                        fileList << f.getAbsolutePath() ;
                    }
                    fileList.sort();
                }
                // Or parameters can be a single file
                else
                    fileList << file.getAbsolutePath() ;

                def results = [:] ;
                fileList.each { apexCodeFile ->
                       //def apexExecCommand = 'sfdx force:apex:execute -f "'+apexCodeFile+'" -u '+this.scratchOrgAlias;
                    //def apexExecCommandResult = Utils.executeCommand(apexExecCommand, 'Execute apex code '+this.apexCodeFile+' in org '+this.scratchOrgAlias);
                    def runRes = this.runApexScriptFile(apexCodeFile,this.scratchOrgAlias)
                    results[apexCodeFile] = runRes.result ;
                    if (runRes.returnValue != null) {
                        def apexCodeFileKey = new File(apexCodeFile).getName()
                        this.jsonLogContent[apexCodeFileKey] = [ 'result' : runRes.result,
                                                                'returnValue': runRes.returnValue ]
                    }
                }

                println results

                Utils.printlnLog('Results of apex code execution (it can be ok if there are errors, but it may need to be looked at)')
                results.each { apexFile , execRes ->
                    def status = 'OK' ;
                    if (execRes == false)
                        status = 'Error' ;
                    Utils.printlnLog(apexFile + ' - '+ status);
                }
                Utils.stopElapse(elpse);
            }
        }

        // Run apex script and get return values if defined ( requires a System.debug('APEX_SCRIPT_VALUE='+someVal)) at the end of the script )
        public runApexScriptFile(codeFile,orgAlias) {
            def apexExecCommand = 'sfdx force:apex:execute -f "'+codeFile+'" -u '+orgAlias;
            def apexExecCommandResult = Utils.executeCommand(apexExecCommand, 'Execute apex code '+codeFile+' in org '+orgAlias);
            def apexExecCommandLogs = Utils.getCommandLog(apexExecCommand);
            def res = [
                'result' : apexExecCommandResult,
                'logLines' : apexExecCommandLogs
            ]
            apexExecCommandLogs.each { line ->
                if (line.contains('APEX_SCRIPT_VALUE='))
                    res.returnValue = Utils.substringAfter(line,'APEX_SCRIPT_VALUE=')
            }
            return res ;
        }

        // Get org info
        public getOrgInfo(String alias) {
            // Try to get org info in cache
            if (this.orgInfoListCache[alias] != null) {
                return this.orgInfoListCache[alias]
            }
            else {
                 // If not in cache, use sfdx command
                this.manageConnectOrg(alias) // Connect to org if necessary
                // Call org info with SFDX
                def orgInfoCommand = 'sfdx force:org:display --json -u '+alias;
                def orgInfoCommandResult = Utils.executeCommand(orgInfoCommand, 'Get org info for '+alias);
                def orgInfoFullResp = Utils.getCommandLogAsObj(orgInfoCommand);
                if (orgInfoFullResp != null) {
                    this.orgInfoListCache[alias] = orgInfoFullResp.result
                    return orgInfoFullResp.result ;
                }
                else
                    return null
            }
        }

        // Get user info
        public getUserInfo(String usr) {
            // Try to get org info in cache
            if (this.usrInfoListCache[usr] != null) {
                return this.usrInfoListCache[usr]
            }
            else {
                // get base user info with SFDX
                def usrInfoCommand = 'sfdx force:user:display --json -u '+usr;
                def usrInfoCommandResult = Utils.executeCommand(usrInfoCommand, 'Get user info for '+usr);
                def usrInfoFullResp = Utils.getCommandLogAsObj(usrInfoCommand);

                // Get additional user info with apex
                def result = null
                if (usrInfoFullResp != null && usrInfoFullResp.result != null) {
                    result = usrInfoFullResp.result
                    def addlUsrInfoCommand = 'sfdx force:data:soql:query -q "SELECT Email FROM User WHERE Username=\''+usr+'\' LIMIT 1" -u '+usr+' --json' ;
                    Utils.executeCommand(addlUsrInfoCommand, 'Query additional user info');
                    def addlUserInfoRes = Utils.getCommandLogAsObj(addlUsrInfoCommand);
                    if (addlUserInfoRes!= null && addlUserInfoRes.result != null && addlUserInfoRes.result.records != null) {
                        def addlUserInfo = addlUserInfoRes.result.records[0]
                        ['Email'].each { prop ->
                            result[prop] = addlUserInfo[prop]
                        }
                    }
                    this.usrInfoListCache[usr] = result
                    Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user",result.username);
                }
                Utils.printlnLog('USER RESULT '+result)



                return result ;
            }
        }

        // Manages selection of a scratch org
        public manageSelectScratchOrg(Boolean allowCreation){

            def configFileScratchOrgAlias = Utils.getPropInJsonFile(this.ownConfigFile,"scratchOrgAlias")
            if (configFileScratchOrgAlias != null && this.ignoreOwnConfigFile == false) {
                this.scratchOrgAlias = configFileScratchOrgAlias ;
                Utils.printlnLog('"scratchOrgAlias" : "'+this.scratchOrgAlias+'"" found in '+this.ownConfigFile+'. If you want to use another scratch org, just delete scratchOrgAlias property from '+this.ownConfigFile);
                Utils.printlnLog('If you have DevHub connection issue, just run 710-List all orgs.bat')
            }

            // Try to reuse existing scratch org
            if (this.scratchOrgNameKey && !this.scratchOrgAlias && this.doNotReuseScratchOrg == false ) {
                def localOrgList = this.listAllScratchOrgs();
                localOrgList.each {scratchOrg ->
                    if ((scratchOrg.alias != null && scratchOrg.alias.contains(scratchOrgNameKey)) || (scratchOrg.username != null && scratchOrg.username.contains(scratchOrgNameKey))) {
                        if (scratchOrg.status == "Active" && scratchOrg.isExpired == false) {
                            this.scratchOrgAlias = scratchOrg.alias ;
                            this.jsonLogContent['scratchOrgUsername'] = scratchOrg.username
                            Utils.printlnLog('Reused scratch org '+scratchOrg) ;
                            this.generateScratchOrgUserPassword();

                            if (allowCreation== true) {
                                this.executeSingleApexCodeFile("./Scripts/apex/901_Kill_scheduled_jobs.apex")
                            }

                        }
                        else
                            Utils.printlnLog('Scratch org not reused because inactive or expired '+scratchOrg) ;
                    }
                }
            }

            // If no projectName specified, list orgs and ask user
            if (!this.scratchOrgAlias) {

                def scratchOrgs = this.listAllScratchOrgs();
                 def orgsChoiceList = [];
                 def orgsChoiceMap = [:];
                Boolean isConnected = false ;
                if (scratchOrgs != null) {
                    for (org in scratchOrgs) {
                        String orgChoice =org.alias +' '+org.orgName+' - '+org.instanceUrl ;
                        orgsChoiceList << orgChoice
                        orgsChoiceMap[orgChoice] = org ;
                    };
                }
                if (allowCreation==true) {
                    String scratchOrgSlctn ;
                    if (this.scratchOrgUserEmail == null)
                        scratchOrgSlctn = Utils.userInputSelect('User input','Please select a scratch org number , or 0 to create a new scratch org : ',orgsChoiceList, 5);
                    if (scratchOrgSlctn != null && scratchOrgSlctn != '' &&
                     orgsChoiceMap[scratchOrgSlctn] != null && orgsChoiceMap[scratchOrgSlctn].alias != null &&
                      orgsChoiceMap[scratchOrgSlctn].alias != '' && this.scratchOrgUserEmail == null) {
                            // Select scratch org
                            this.scratchOrgAlias = orgsChoiceMap[scratchOrgSlctn].alias ;
                    } else {
                            // Create new scratch org
                            if (this.scratchOrgUserEmail == null) {
                                this.scratchOrgAlias = Utils.userInputText('Please enter the name of the new scratch org (without spaces or special characters, AND WITH YOUR NAME IN IT FOR GOD SAKE :) ', 5)
                                // Store choice if request in config file
                                if (Utils.userPromptOkCancel('Do you want this new scratch org to be your default one ? (in '+this.ownConfigFile+')', 5)) {
                                    Utils.setPropInJsonFile(this.ownConfigFile,"scratchOrgAlias",this.scratchOrgAlias)
                                }
                            }
                            // Define scratch org description as JSON
                            this.defJsonCreation()
                    }
                }
                else {
                    // Request user choice
                    String scratchOrgSlctn = Utils.userInputSelect('User input','Please select a scratch org number',orgsChoiceList, 5);
                    if (scratchOrgSlctn != null && scratchOrgSlctn != '') {
                        this.scratchOrgAlias = orgsChoiceMap[scratchOrgSlctn].alias ;
                        // Store choice if request in config file
                        if (this.ignoreOwnConfigFile == false &&  Utils.userPromptOkCancel('Do you want to remember your scratch org choice ?', 5)) {
                              Utils.setPropInJsonFile(this.ownConfigFile,"scratchOrgAlias",this.scratchOrgAlias)
                        }

                    }
                }

            }

            if (this.scratchOrgAlias) {
                this.jsonLogContent['scratchOrgAlias'] = this.scratchOrgAlias ;
            }
        }

        // Open a scratch org
        public openScratchOrg() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            if (this.scratchOrgAlias)    {
                // Open org
                def orgOpenCommand = 'sfdx force:org:open -u '+this.scratchOrgAlias;
                def orgOpenCommandResult = Utils.executeCommand(orgOpenCommand,'Open scratch org',this.currentProjectPath);

                // Display org info
                //def orgInfo = this.getOrgInfo(this.scratchOrgAlias);
                def orgInfoCommand = 'sfdx force:org:display -u '+this.scratchOrgAlias;
                def orgInfoCommandResult = Utils.executeCommand(orgInfoCommand, 'Get org info for '+this.scratchOrgAlias,this.currentProjectPath);

                // Set default username
                def orgInfo = this.getOrgInfo(this.scratchOrgAlias);
                def defaultUsernameCommand = 'sfdx force:config:set defaultusername='+orgInfo.username;
                def defaultUsernameCommandResult = Utils.executeCommand(defaultUsernameCommand, 'Set local sfdx default username to '+this.scratchOrgAlias,this.currentProjectPath);

                // Check for scratch org expiration date
                this.checkScratchOrgExpirationDate(true)

            }
        }

        public executeTestClasses() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            if (this.scratchOrgAlias)    {

                // Check if test not already succeded ( in the case do not run again)
                if (Utils.getExternalValue(this.globalKeyPrefix,'scratchTest_'+this.scratchOrgAlias+'-'+this.packageXmlFile) == 'success' && this.globalKeyPrefix != null) {
                    Utils.printlnLog('Skip tests in '+this.scratchOrgAlias+' already performed for global key '+this.globalKeyPrefix);
                    return true;
                }

                // Collect list of test classes if packageXmlFile is provided
                String testClassListStr = null ;
                def devClassList = [];
                if (this.packageXmlFile) {
                    def packageXmlMap = UtilsPackageXML.packageXMLtoMap(this.packageXmlFile);
                    def classList = packageXmlMap['ApexClass'];
                    def testClassList = [];

                    classList.each { apexClass ->
                        if (apexClass.contains('Test'))
                            testClassList << apexClass
                        else
                            devClassList << apexClass
                    }
                    testClassListStr = testClassList.join(',');
                }

                // Run tests
                def runTestsCommand = 'sfdx force:apex:test:run '+((testClassListStr != null)?'--classnames "'+testClassListStr+'"':'--testlevel RunAllTestsInOrg ')+' --codecoverage --resultformat "json" --wait 20 -u '+this.scratchOrgAlias+' --json';
                def runTestsCommandResult = Utils.executeCommand(runTestsCommand,'Run test classes '+testClassListStr,this.currentProjectPath);

                // Parse results
                def runTestsCommandLogObj = Utils.getCommandLogAsObj(runTestsCommand)

                // Check testClasses passed
                Utils.printlnLog();
            //    Utils.printlnLog('TEST LOGS RESULTS: '+runTestsCommandLogObj.result.summary+'\n');
                if(runTestsCommandLogObj.result != null){
                    if (runTestsCommandLogObj.result.summary.failing > 0) {
                        Utils.printlnLog('FAILED TEST CLASSES:');
                        runTestsCommandLogObj.result.tests.each { testX ->
                            if (testX.Outcome == 'Fail') {
                                Utils.printlnLog('- '+testX.ApexClass.Name+' ; '+testX.StackTrace + ' ; ' + testX.Message);
                            }
                        }
                    }
                    Utils.printlnLog();

                    assert (runTestsCommandResult == true && runTestsCommandLogObj.result.summary.failing == 0),  "[ERROR] Apex test classes execution failed"
                    Utils.printlnLog('Test coverage line coverage');
                    float testRunCoverage;
                    float orgWideCoverage;
                    float coveredLinesPercentage;

                    if (runTestsCommandLogObj.result.coverage.summary.testRunCoverage!= null) {
                        String testRuncoverageString = runTestsCommandLogObj.result.coverage.summary.testRunCoverage;
                        testRunCoverage = Float.parseFloat(testRuncoverageString.replace("%",""));
                    }
                    if (runTestsCommandLogObj.result.coverage.summary.orgWideCoverage!= null) {
                        String orgWideCoverageString = runTestsCommandLogObj.result.coverage.summary.orgWideCoverage;
                        orgWideCoverage = Float.parseFloat(orgWideCoverageString.replace("%",""));
                    }
                    if (runTestsCommandLogObj.result.coverage.summary.totalLines!= null && runTestsCommandLogObj.result.coverage.summary.coveredLines != null) {
                        String totalLinesString = runTestsCommandLogObj.result.coverage.summary.totalLines;
                        String coveredLinesString = runTestsCommandLogObj.result.coverage.summary.coveredLines;
                        float totalLines =Float.parseFloat(totalLinesString.replace("%",""));
                        float coveredLines = Float.parseFloat(coveredLinesString.replace("%",""));
                        coveredLinesPercentage = Math.round( coveredLines / totalLines) * 100;
                        Utils.printlnLog('coveredLinesPercentage : '+coveredLinesPercentage);
                    }
                    assert (testRunCoverage > 75.0 && orgWideCoverage > 75.0 &&  coveredLinesPercentage > 75.0) , '[ERROR] Total package.xml coverage does not reach 75% ('+totalCoverPercent+')'
                    /*if (this.packageXmlFile) {
                        def totalCover = 0
                        def totalCoverNb = 0
                        def coverageClassResultLs = runTestsCommandLogObj.result.coverage.coverage ;
                        coverageClassResultLs.each { coverageClsRes ->
                            if (devClassList.contains(coverageClsRes.name)) {
                                totalCover = totalCover + coverageClsRes.coveredPercent
                                totalCoverNb++
                            }
                        }

                        assert (totalCover > 0 && totalCoverNb > 0), "Error, code coverage has not been returned correctly from SFDX logs"

                        def totalCoverPercent = totalCover / totalCoverNb
                        def totalCoverPecentRound = Math.round( totalCoverPercent * 100) / 100
    *//*
                        Utils.printlnLog();
                        Utils.printlnLog('Package.xml items code coverage: '+totalCoverPecentRound+'%');
                        Utils.printlnLog();
                        assert totalCoverPercent > 75.0 , '[ERROR] Total package.xml coverage does not reach 75% ('+totalCoverPercent+')'
    */
                //    }
                    // Store info that test is ok to avoid running the same tests again if the commit did not change
                    if ( this.globalKeyPrefix != null) {
                        Utils.setExternalValue(this.globalKeyPrefix,'scratchTest_'+this.scratchOrgAlias+'-'+this.packageXmlFile, 'success')
                    }
                }

            }
        }

        // Run test case after user choice
        public runTestCase() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            // List test campaign files
            String dir = this.playerScriptsFolder ;
            def fileLs = Utils.listDirectoryFiles(dir) ;
            def fileChoicels = [];
            fileLs.each {file ->
                if (file.endsWith('.txt'))
                    fileChoicels.add(file);
            }

            // Ask user which test case campaign he wants to use
            def campaingFileSlctn = Utils.userInputSelect('User input','Please select a test campaigns file : ',fileChoicels, 5);

            // List test cases of selected campaigns file
            def deployTestCasesFile = new File(campaingFileSlctn);
            def testChoiceLs = []
            deployTestCasesFile.eachLine { line ->
                def file = new File(playerScriptsFolder+'/'+line);
                if (!file.exists() || line.trim() == '') {
                    return ;
                }
                testChoiceLs.add(line);
            }
            // ask user the test case he wants to run
            def testCaseSlctn = Utils.userInputSelect('User input','Please select a test case : ',testChoiceLs, 5);

            def sfdcUsername = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user");
            if (sfdcUsername == null) {
                def orgInfo = this.getOrgInfo(this.scratchOrgAlias);
                sfdcUsername = orgInfo.username ;
                Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user",sfdcUsername);
            }
            def sfdcPassword = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_pwd");
            if (sfdcPassword == null) {
                this.generateScratchOrgUserPassword()
                sfdcPassword = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_pwd");
            }

            def communitiesBaseUrl = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_communities_base_url");
            if (communitiesBaseUrl == null && new File("./Scripts/apex/getCommunitiesBaseUrl.apex").exists()) {
                this.executeSingleApexCodeFile("./Scripts/apex/getCommunitiesBaseUrl.apex")
                communitiesBaseUrl = this.jsonLogContent['getCommunitiesBaseUrl.apex'].returnValue ;
                Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_communities_base_url",communitiesBaseUrl);
            }

            // Build player command line
            def playerCmdSuffix = ' -SFDC_USERNAME '+sfdcUsername
            playerCmdSuffix+=' -SFDC_PASSWORD '+sfdcPassword // use strong quotes to not be bored by special chars
            playerCmdSuffix+=' -TEST_BASE_URL '+communitiesBaseUrl
            playerCmdSuffix+=' -JSON '
            def testCommand = 'lelamanul-player -COMMANDLINE -CONFIG_FILE '+this.playerConfigFile+' -COMMANDS_FILE '+System.properties.'user.dir'+this.playerScriptsFolder+'/'+testCaseSlctn+' -NEVER_RECORD_VIDEOS -DO_NOT_STORE_CONFIG'+playerCmdSuffix ;
            def testCommandResult = Utils.executeCommand(testCommand,'DXCPLAYER: Run test case :'+testCaseSlctn,System.properties.'user.dir'+'./PlayerScripts',false);
            def testCommandLog = Utils.getCommandLog(testCommand)
            Utils.printlnLog(testCommandLog)

        }

        public checkScratchOrgExpirationDate(Boolean guiWarning=false) {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

               if (this.scratchOrgAlias)    {
                   // Get org info in JSON format
                def orgInfoCommand = 'sfdx force:org:display -u '+this.scratchOrgAlias+' --json';
                def orgInfoCommandResult = Utils.executeCommand(orgInfoCommand, 'Get org info for '+this.scratchOrgAlias,this.currentProjectPath);

                def orgInfo = Utils.getCommandLogAsObj(orgInfoCommand);

                assert orgInfo != null , 'Unable to parse json from '+orgInfo.toString()

                Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user",orgInfo.result.username);

                // Compare expiration date & today date
                def expirationDate = Date.parse('yyyy-MM-dd',orgInfo.result.expirationDate)
                def todayDate = new Date()
                def duration = groovy.time.TimeCategory.minus(expirationDate,todayDate);
                def remainingDays = duration.days
                Utils.printlnLog(remainingDays +' remaining days before scratch org expiration')

                // Display warning in case expiry is close
                if (remainingDays <= this.scratchOrgExpiryWarningDaysNb && guiWarning == true) {
                    Utils.displayImportant()
                    def warningTxt = 'You scratch org will expire in '+remainingDays+' days !!!\nPlease make sure you have its content in your local git branch, then create a new scratch org if you do not want to take the risk to loose all your work :)'
                    Utils.printlnLog(warningTxt)
                    Utils.userDisplayPopup(warningTxt,'Warning')
                }

            }
        }

        // Deletes a scratch org
        public deleteScratchOrg(Boolean all) {
            if (all == true)
                this.browseAllOrgs = true
            this.manageSelectSFDXProject();

            // Bulk delete scratch org: list and delete all those matching scratchOrgAlias and duration ( in hours )
            if (this.scratchOrgDuration != null) {
                def matchingString = this.scratchOrgAlias
                def scratchOrgDurationInt = Integer.valueOf(this.scratchOrgDuration)
                Utils.printlnLog('Scratch orgs matching with '+matchingString+' and not used for '+scratchOrgDurationInt+' hours will be deleted')
                this.browseAllOrgs = true ;
                def scratchOrgs = this.listAllScratchOrgs()
                Date dateToCompare
                use (TimeCategory) {
                    dateToCompare = new Date() - scratchOrgDurationInt.'hours'
                }
                Utils.printlnLog('Maximum last used date time before deletion: '+dateToCompare)
                def deletedScratchorgls = []
                scratchOrgs.each {scratchOrg ->
                    if (scratchOrg.username.contains(matchingString)) {
                        if (scratchOrg.lastUsed == null)
                            scratchOrg.lastUsed = Date.parse("yyyy-MM-dd",'1984-04-07')
                        Utils.printlnLog '-browsing '+scratchOrg.username+' last used on '+scratchOrg.lastUsed
                        def dateLastUsed = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS",scratchOrg.lastUsed)
                        Utils.printlnLog('Matching scratch org last used date: '+dateLastUsed)
                        if (dateLastUsed.before(dateToCompare)) {
                            this.scratchOrgAlias = scratchOrg.username
                            def orgDeleteCommand = 'sfdx force:org:delete -p -u '+ this.scratchOrgAlias
                            def orgDeleteCommandResult = Utils.executeCommand(orgDeleteCommand,'Delete scratch org '+this.scratchOrgAlias,this.currentProjectPath)
                            deletedScratchorgls << scratchOrg.username
                        }
                    }
                }

                this.jsonLogContent['deletedScratchorgs'] = deletedScratchorgls
            }
            else {
                // Manual or single scratch org deletion
                Boolean scratchOrgToDeleteSentFromParams = false
                if (this.scratchOrgAlias) {
                    scratchOrgToDeleteSentFromParams = true
                }
                this.manageSelectScratchOrg(false);

                if (this.scratchOrgAlias)    {
                    def orgOpenCommand = 'sfdx force:org:delete -p -u '+ this.scratchOrgAlias;
                    def orgOpenCommandResult = Utils.executeCommand(orgOpenCommand,'Delete scratch org '+this.scratchOrgAlias,this.currentProjectPath);
                }

                if (scratchOrgToDeleteSentFromParams == false) {
                    Boolean deleteAnother = Utils.userPromptOkCancel('Do you want to delete another scratch org ?');
                    if (deleteAnother) {
                        this.scratchOrgAlias = null
                        this.forceOrgListCache = null
                        this.deleteScratchOrg(all)
                    }
                }
            }

        }

        // List all scratch orgs attached to the dev hub (output log)
        public listAllOrgs() {
            this.manageConnectOrg(this.devHubName);

            def orgListCommand = 'sfdx force:org:list';
            def orgListCommandResult = Utils.executeCommand(orgListCommand,
                                                      'List all orgs',null);
        }

        // List all scratch org attached to the dev hub (JSON response)
        public listAllScratchOrgs() {
            this.manageConnectOrg(this.devHubName);
             def forceOrgListResult = this.forceOrgList();
            if (!forceOrgListResult.result)
                return [] ;
            def scratchOrgs = forceOrgListResult.result.scratchOrgs ;
            return scratchOrgs ;
        }

        // Make force:org:list --json call and manage cache to avoid to call it 10 times during a script execution
        public forceOrgList() {
            if (this.forceOrgListCache != null)
                return this.forceOrgListCache ;
            else {
                def orgListCommand = 'sfdx force:org:list --json';
                if (this.browseAllOrgs == true)
                    orgListCommand+= ' --all'
                def orgListCommandResult = Utils.executeCommand(orgListCommand,
                                                    'List all orgs for scratch org list',null,false);

                def parseRes = Utils.getCommandLogAsObj(orgListCommand)
                assert parseRes != null , 'Unable to parse json from '+Utils.getCommandLog(orgListCommand)
                this.forceOrgListCache = parseRes
                return parseRes
            }
        }

        // Lists all the installed packages of an org
        public listOrgInstalledPackages(String paramScratchOrgAlias) {
            def listpackagesCmd = 'sfdx force:data:soql:query -q "SELECT DurableId,IsSalesforce,MajorVersion,MinorVersion,Name,NamespacePrefix FROM Publisher WHERE MajorVersion > 0 AND MinorVersion > 0" -u '+paramScratchOrgAlias+' --json' ;
            Utils.executeCommand(listpackagesCmd, 'Query list of packages installed in the scratch org');

            def packageVersionList = Utils.getCommandLogAsObj(listpackagesCmd);

            def installedPackageList = [] ;
            packageVersionList.result.records.each {
                installedPackageList << ['Name' : it['Name'], 'NamespacePrefix' : it['NamespacePrefix'],'MinorVersion': it['MinorVersion'], 'MajorVersion': it['MajorVersion'] ] ;
            }
            return installedPackageList ;
        }

        // Pulls scratch org metadatas into local project folder
        public pullScratchOrg() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            def elpse = Utils.startElapse('Pull scratch org '+this.scratchOrgAlias+' to SFDX Project '+this.projectName) ;

            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;
             def pullCommand = 'sfdx force:source:pull --forceoverwrite -u '+this.scratchOrgAlias;
            def pullCommandResult = Utils.executeCommand(pullCommand,'Pull scratch org',sfdxWorkingDir);

            Utils.stopElapse(elpse);
            assert pullCommandResult == true,  "[ERROR] Pull scratch org failed"
        }

        // Push SFDX Projecct metadatas to source org
        public convertSfdxProjectToMetadata() {
            this.manageSelectSFDXProject();

            def elpse = Utils.startElapse('Convert SFDX Project '+this.projectName+' into Metadatas') ;

            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;
             def convertCommand = 'sfdx force:source:convert -d '+this.metadatasDeployFolder+'/ --rootdir '+this.sfdxSourcesFolder;
            def convertCommandRes = Utils.executeCommand(convertCommand,'Convert '+this.projectName+' into Metadatas to '+this.metadatasDeployFolder+'/',sfdxWorkingDir);

            Utils.stopElapse(elpse);
            assert convertCommandRes == true,  "[ERROR] Convert SFDX Project to metadatas failed"
        }

        public fixMetadatasBeforeDeploy() {
            def elpse = Utils.startElapse('Fix metadatas before deploy') ;
            updateFilesWithOrgContext('md')
            Utils.stopElapse(elpse);
        }

        /**
         * Fix metadata XML files before deployment to sourceEnvName
         */
        public fixMetadataBeforeDeployToDestinationOrg() {
            def elpse = Utils.startElapse('Fix metadatas before deploy to '+this.sourceEnvName);
            updateFilesWithOrgContext('md')
            Utils.stopElapse(elpse);
        }

        /**
         * Fix metadata XML files before push to scratchOrg
         */
        public fixMetadataBeforePushToScratchOrg() {
            def elpse = Utils.startElapse('Fix metadatas before push to '+this.scratchOrgAlias);
            updateFilesWithOrgContext('sfdx')
            Utils.stopElapse(elpse);
        }

        public updateFilesWithOrgContext (mode) {
            def updatesWithOrgContextList = Utils.getPropInJsonFile(this.sharedConfigFile,"updatesWithOrgContextList")
            if (updatesWithOrgContextList == null)
                return ;

            updatesWithOrgContextList.each { updateDef ->
                // Replace text in a file
                if (updateDef.type == 'replaceText') {
                    def file = this.getLocalFilePath(mode,updateDef)
                    def replaceVal = this.getLocalContextValue(mode,updateDef.value)
                    if (replaceVal != null)
                        this.doReplaceInFile(file, ~updateDef.regexp, replaceVal)
                }
                // Replace text in all files of a directory
                else if (updateDef.type == 'replaceTextInFiles') {
                    def dir = this.getLocalFilePath(mode,updateDef)
                    def replaceVal = this.getLocalContextValue(mode,updateDef.value)
                    if (replaceVal != null) {
                        Utils.printlnLog("> browsing $dir for replace $replaceVal using pattern ${updateDef.regexp}");
                        def fileLs = Utils.listDirectoryFiles(dir)
                        fileLs.each {file ->
                            this.doReplaceInFile(file, ~updateDef.regexp, replaceVal)
                        }
                    }
                }
                // Replace the content of a file
                else if (updateDef.type == 'fileContent') {
                    def fileContent = this.getLocalContextValue(mode,updateDef.value)
                    if (fileContent != null) {
                        def file = this.getLocalFilePath(mode,updateDef)
                        def fileOpened = new File(file);
                        if (fileOpened.exists() && fileOpened.text != fileContent) {
                            fileOpened.text = fileContent ;
                            Utils.printlnLog('- updated file content of '+file)
                        }
                        else
                            Utils.printlnLog('- no update of file content of '+file+' (identical or not found)')
                    }
                }
            }
        }

        private getLocalFilePath(mode,updateDef) {
            if (mode == 'sfdx')
                return './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder+'/'+updateDef.sfdx_file
            else if (mode == 'md')
                return './'+this.projectDir+'/'+this.projectName+'/'+this.metadatasDeployFolder+'/'+updateDef.md_file
        }

        private getLocalContextValue(mode,value) {
            // sfdc org url
            if (value == 'org.instanceUrl') {
                def org = this.getOrgInfo((mode == 'sfdx')?this.scratchOrgAlias:this.sourceEnvName)
                if (org != null)
                    value = org.instanceUrl
                else
                    value = null
            }
            // sfdc org sdministrator username
            else if (value == 'org.adminUsername') {
                def org = this.getOrgInfo((mode == 'sfdx')?this.scratchOrgAlias:this.sourceEnvName)
                if (org != null)
                    value = org.username
                else
                    value = null
            }
            // sfdc org administrator email
            else if (value == 'org.adminEmail') {
                def org = this.getOrgInfo((mode == 'sfdx')?this.scratchOrgAlias:this.sourceEnvName)
                def usrInfo = this.getUserInfo(org.username)
                if (usrInfo != null)
                    value = (usrInfo['Email']!=null)?usrInfo['Email']:(this.scratchOrgUserEmail!=null)?this.scratchOrgUserEmail:this.userEmail
                else
                    value = null
            }
            return value
        }

        /**
         * Search regex matching strings in file and update the inner value
         * @fileName The file to update
         * @searchRegex the regex (with 2 groups mandatory) to search in the file. It must have the following form : /(start)something(end)/
         * @replacementValue the replacement string for the middle (something) part
         */
        private doReplaceInFile(String fileName, def searchRegex, String replacementValue) {
            def baseURLFile = new File(fileName);
            if (baseURLFile.exists()) {
                String baseURLText = baseURLFile.text.replaceAll(searchRegex,{ all, start, end -> start + replacementValue + end });
                  if(baseURLFile.text != baseURLText){
                    baseURLFile.text = baseURLText;
                    Utils.printlnLog("- updated $fileName with $replacementValue using pattern $searchRegex");
                 }
                else
                    Utils.printlnLog("- identical $fileName with $replacementValue using pattern $searchRegex");
            }
            else
                Utils.printlnLog("- file not found for update: $fileName with $replacementValue using pattern $searchRegex");
         }

        public filterMetadatasBeforeDeploy() {
            if (this.packageXmlFile != null && this.metadatasDeployFolder != null && this.metadatasDeployFolderOutput)
            {
                def elpse = Utils.startElapse('Filter Metadatas before deploy')
                // Copy custom packageXml file to package.xml deployment folder
                def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;
                def generatedPackageXmlFileName = sfdxWorkingDir+'/'+this.metadatasDeployFolder+'/package.xml';
                Utils.copyFile(this.packageXmlFile,generatedPackageXmlFileName)

                 def filterCommand = 'sfdx essentials:filter-metadatas -i '+sfdxWorkingDir+'/'+this.metadatasDeployFolder+' -p '+this.packageXmlFile+' -o '+sfdxWorkingDir+'/'+this.metadatasDeployFolderOutput+' -v' ;
                 def filterCommandRes = Utils.executeCommand(filterCommand,'Filter metadatas before deploy');

                Utils.killDir(sfdxWorkingDir+'/'+this.metadatasDeployFolder) ;

                Utils.stopElapse(elpse);
                assert filterCommandRes == true,  "[ERROR] Filter metadatas using package.xml failed"
            }
        }


        // Push SFDX Projecct metadatas to source org
        public deploySfdxProjectToSourceEnv() {
            this.manageSelectSFDXProject();
            this.manageConnectOrg(this.sourceEnvName);

            def elpse = Utils.startElapse('Deploy SFDX Project '+this.projectName+' into '+this.sourceEnvName) ;

            // Check if test not already succeded ( in the case do not run again)
            if (Utils.getExternalValue(this.globalKeyPrefix,'scratchDeploy_'+this.sourceEnvName+'-'+this.packageXmlFile) == 'success') {
                Utils.printlnLog('Skip deploy in '+this.sourceEnvName+' already performed for global key '+this.globalKeyPrefix);
                Utils.stopElapse(elpse);
                return true;
            }


            this.fixMetadataBeforeDeployToDestinationOrg()

            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;

            if (new File(sfdxWorkingDir+'/'+this.metadatasDeployFolder+'/unpackaged').exists()) {
                def unpackagedFolderName = sfdxWorkingDir+'/'+this.metadatasDeployFolder+'/unpackaged'
                Utils.printlnLog('Found unpackaged folder in '+sfdxWorkingDir+'/'+this.metadatasDeployFolder+' : put its content at root deployment dir and kill it')
                Utils.copyDirContent(unpackagedFolderName,sfdxWorkingDir+'/'+this.metadatasDeployFolder)
                Utils.killDir(unpackagedFolderName)
            }

             def deployCommand = 'sfdx force:mdapi:deploy -d '+this.metadatasDeployFolder+'/ -w 90 -u '+this.sourceEnvName;
            def deployCommandRes = Utils.executeCommand(deployCommand,'Deploy '+this.metadatasDeployFolder+' to '+this.sourceEnvName,sfdxWorkingDir);

            Utils.killDir(sfdxWorkingDir+'/'+this.metadatasDeployFolder) ;

            Utils.stopElapse(elpse);
            assert deployCommandRes == true,  "[ERROR] Deploy Metadatas failed"

            if (deployCommandRes == true) {
                Utils.setExternalValue(this.globalKeyPrefix,'scratchDeploy_'+this.sourceEnvName+'-'+this.packageXmlFile, 'success');
            }
        }

        public exportData() {
            this.manageSelectSFDXProject();

            def elpse = Utils.startElapse('Export records') ;

            def sfdxWorkingDirData = './'+this.projectDir+'/'+this.projectName+'/data' ;
            def exportCommand = 'sfdx force:data:tree:export -p -q "'+this.exportQuery+'" -u '+this.sourceEnvName+' -d '+this.exportFolder;
            def exportCommandRes = Utils.executeCommand(exportCommand,'Export '+this.exportFolder+' from '+this.sourceEnvName,sfdxWorkingDirData);

            Utils.stopElapse(elpse);
            assert exportCommandRes == true,  "[ERROR] Export data failed"
        }

        public importData() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            def elpse = Utils.startElapse('Import records') ;
            def sfdxWorkingDirData = './'+this.projectDir+'/'+this.projectName+'/data' ;

             // Update sourcePathInfos
            new AntBuilder().fileScanner {
                fileset(dir: sfdxWorkingDirData, includes: '**/**-plan.json')
            }.each { File f ->
                def planFilePath = f.getAbsolutePath();
                def importCommand = 'sfdx force:data:tree:import -p '+planFilePath+' -u '+this.scratchOrgAlias;
                def importCommandRes = Utils.executeCommand(importCommand,'Import '+planFilePath+' in '+this.scratchOrgAlias,sfdxWorkingDirData);

            }

            Utils.stopElapse(elpse);
        }

        ///// Build CSS from SCSS ////
        public sassProcessing() {
            def elpseSass = Utils.startElapse('SASS processing')
            Utils.testAvailableCommands(['sass']);

            // Read config file in PROJECT/config/themes-config.json
            this.manageSelectSFDXProject();
            def staticResourceList = Utils.getJsonFile('./'+this.projectDir+'/'+this.projectName+'/config/themes-config.json') ;

            // If themeToProcess == "select" , ask user
            if (this.themeToProcess == 'select') {
                def selectableThemes = []
                for (int i; i < staticResourceList.size(); i++ ) {
                    for (int j; j < staticResourceList[i].staticResourceThemes.size(); j++ ) {
                        selectableThemes << staticResourceList[i].staticResourceThemes[j].name
                    }
                }
                this.themeToProcess = Utils.userInputSelect('User input','Please select a theme to generate SCSS: ',selectableThemes, 2);
                Utils.printlnLog('To avoid selection every time, create a BAT file with argument -themeToProcess "YOUR_THEME_NAME"')
            }

            // Browse defined static resources
            def sassCommandResultList = [] ;
            def mainStaticResource = null ;
            def defaultTheme = null ;
            for (int i; i < staticResourceList.size(); i++ ) {
                def staticRes = staticResourceList[i] ;
                if (staticRes.isMain == true)
                    mainStaticResource = staticRes ;
                def staticResPath = './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder+'/staticresources/'+staticRes.name ;

                // Create static resource if not existing yet ( just added in config file)
                def newThemeJustCreated = false ;
                if (this.themeToProcess == 'all' && !(new File(staticResPath).exists())) {
                    Utils.printlnLog('NEW STATIC RESOURCE DEFINITION FOUND: '+staticRes.name)
                    newThemeJustCreated = true ;
                    // Create static resource folder
                    Utils.checkCreateDir(staticResPath) ;
                    def mainStaticResPath = './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder+'/staticresources/'+mainStaticResource.name ;
                    Utils.copyFile(mainStaticResPath+'/resource/css/scss/custom/custom.scss',staticResPath+'/resource/css/scss/custom/custom.scss');
                    // Create static resource meta
                    def staticResPathMeta = new File(staticResPath+'.resource-meta.xml');
                    staticResPathMeta.text = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
                        <cacheControl>Private</cacheControl>
                        <contentType>application/x-zip-compressed</contentType>
                        <description>Theme $staticRes.name</description>
                    </StaticResource> """ ;
                    Utils.printlnLog('Created new static resource meta file: '+staticResPathMeta);

                    // Initialize by copying from main theme static resource
                    this.mergeBaseResourceInCustomResource(mainStaticResPath,staticResPath);
                }

                // Merge base theme resource into custom theme resource if necessary
                if (this.themeToProcess == 'all' && !staticRes.isMain && newThemeJustCreated == false) {
                    def mainStaticResPath = './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder+'/staticresources/'+mainStaticResource.name ;
                    this.mergeBaseResourceInCustomResource(mainStaticResPath,staticResPath);
                }

                // Browse each theme defined in a static resource
                for (int j; j < staticRes.staticResourceThemes.size(); j++ ) {
                    def theme = staticRes.staticResourceThemes[j] ;
                    if (theme.isDefault == true)
                        defaultTheme = theme

                    if (! (this.themeToProcess == 'all' ||
                         (this.themeToProcess == 'main' && staticRes.isMain && theme.isDefault) ||
                          this.themeToProcess == theme.name
                         )
                    ) {
                        continue ; // Do not process theme if not requested
                    }

                    // Kill old cache files & map file
                    Utils.killDir(System.getProperty('user.dir')+'/.sass-cache');
                    Utils.killFiles(new File(staticResPath+'/'+theme.targetCss).getParentFile().getAbsolutePath(),['map'],['.sass-cache'],[]) ;

                    // Call SASS to generate css from SCSS
                    def sassCommand = 'sass "'+staticResPath+'/'+theme.sourceScss+'" "'+staticResPath+'/'+theme.targetCss+'" --style=expanded --trace' ;
                    def sassCommandResult = Utils.executeCommand(sassCommand,'Build CSS from SCSS for '+staticRes.name+' '+theme.name);
                    sassCommandResultList << sassCommandResult ;

                    // Kill old cache files & map file
                    Utils.killDir(System.getProperty('user.dir')+'/.sass-cache');
                    Utils.killFiles(new File(staticResPath+'/'+theme.targetCss).getParentFile().getAbsolutePath(),['map'],['.sass-cache'],[]) ;
                }
            }

            Utils.stopElapse(elpseSass);
            assert !sassCommandResultList.contains(false),  "SASS compilation ERROR"
        }

        // When base theme resource is updated, it has to be propagated to custom resources
        public mergeBaseResourceInCustomResource(baseResourceFolder,customResourceFolder) {
            def elpseMerge = Utils.startElapse('Merge base & resource folders')

            def baseDir = new File(baseResourceFolder);
            def customDir = new File(customResourceFolder);

            def ant = new AntBuilder()
            // Copy up to date CSS, SCSS & fonts from base ( overwrite, as they must not be updated at custom level)
            // Do not touch anything containing custom
            println ('>> Copying base resource files into custom resource files (with overwrite)')
            def dirCopyResult = ant.copy( todir: customDir, overwrite: true) {
                fileset(dir: baseDir) {
                    exclude ( name: '**/custom.scss' )
                    exclude ( name: '**/img/**')
                    exclude ( name: '**/*.css' )
                }
            }

            // Copy images from base, but do not overwrite in case they have been replaced
            println ('>> Copying base resource images into custom resource files (without overwrite)')
            String imgFolder = "\\resource\\img\\" ;
            baseDir.eachFileRecurse (FileType.FILES) { file ->
                def filePath = file.getAbsolutePath();
                if (filePath.contains(imgFolder))
                {
                    def customFolderFilePath = customDir.getAbsolutePath() + imgFolder+ filePath.substring(filePath.lastIndexOf(imgFolder) + imgFolder.length() ) ;
                    def customFolderFile = new File(customFolderFilePath);
                    if (!customFolderFile.exists())
                        Utils.copyFile(filePath,customFolderFilePath);
                    else {
                        if (customFolderFile.length() != file.length())
                            println 'SKIPPED because overwritten : '+customFolderFile.getName();
                        else
                            Utils.copyFile(filePath,customFolderFilePath);
                    }

                }
            }

            // Copy initial custom.scss in case it is not defined yet
            def customCustomScss = new File(customResourceFolder+'/resource/css/scss/custom/custom.scss');
            if (!customCustomScss.exists()) {
                println ('>> Copying base custom.scss into custom resource folder')
                Utils.copyFile(baseResourceFolder+'/resource/css/scss/custom/custom.scss',customResourceFolder+'/resource/css/scss/custom/custom.scss');
            }

            Utils.stopElapse(elpseMerge);
        }

        // Generates a managed package
        public generateManagedPackage() {
            this.manageSelectSFDXProject()

            this.manageConnectOrg(this.packagingOrgAlias);

            def elpseSass = Utils.startElapse('Package generation')

            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName ;

            // Get config file
            def packageDefFileName = sfdxWorkingDir+'/config/package-def.json'
            if (!new File(packageDefFileName).exists()) {
                packageDefFileName = sfdxWorkingDir+'/config/package-def-'+this.packagingOrgAlias+'.json'
            }

            assert new File(packageDefFileName).exists() , packageDefFileName +' missing'
            def pckgDef = Utils.fromJsonString(new File(packageDefFileName).text);

            // List version before
            def vrsnCommand = 'sfdx force:package1:version:list --packageid '+pckgDef['packageId']+' -u '+this.packagingOrgAlias
            Utils.executeCommand(vrsnCommand,'Get package version list',sfdxWorkingDir);

            // Generate package version
            def gnrtCommand = 'sfdx force:package1:version:create --packageid "'+pckgDef['packageId']+'" --name "'+pckgDef['name']+'" --description "'+pckgDef['description']+ '" --postinstallurl "' +pckgDef['postinstallurl']+ '" --version "'+pckgDef['version']+'" --managedreleased --wait 240 -u '+this.packagingOrgAlias+' --json' ;
            def gnrtCommandResult = Utils.executeCommand(gnrtCommand,'Generate Managed Package',sfdxWorkingDir);
            def packageResult = Utils.getCommandLogAsObj(gnrtCommand)
            this.jsonLogContent['packageResult'] = packageResult

            // Actions if package generation is successful
            if (packageResult.status == 0 && packageResult.result['Status'] == 'SUCCESS' ) {

                // List versions after generation
                def vrsnCommandJ = 'sfdx force:package1:version:list --packageid '+pckgDef['packageId']+' -u '+this.packagingOrgAlias +' --json'
                Utils.executeCommand(vrsnCommandJ,'Get new package version list',sfdxWorkingDir);
                def pkgVersionsAfterRes = Utils.getCommandLogAsObj(vrsnCommandJ)
                if (pkgVersionsAfterRes != null && pkgVersionsAfterRes.result != null) {
                    def lastPos = pkgVersionsAfterRes.result.size() - 1
                    def justCreatedPkgVersion = pkgVersionsAfterRes.result[lastPos]
                    this.jsonLogContent['packageResult']['newVersion'] = justCreatedPkgVersion
                }

                // Update sharedConfig file with new package version id
                def configPackages = Utils.getPropInJsonFile(this.sharedConfigFile,"packages")
                Utils.printlnLog('sharedConfig packages before update:'+configPackages)
                if (configPackages == null)
                    configPackages = [:]
                def pkgInternalKey = pckgDef['internalKey']
                def configPackage = configPackages[pkgInternalKey]
                if (configPackage == null)
                    configPackage = [:]
                configPackage['id'] = packageResult.result['MetadataPackageVersionId']
                configPackages[pkgInternalKey] = configPackage
                Utils.printlnLog('sharedConfig packages after update:'+configPackages)
                Utils.setPropInJsonFile(this.sharedConfigFile,"packages",configPackages)
            }

            Utils.stopElapse(elpseSass);
            assert gnrtCommandResult == true,  "Package generation ERROR"

        }

        // List active scratch orgs
        public listDevHubActiveScratchOrgs() {
            this.manageSelectSFDXProject()
            this.manageConnectOrg(this.devHubName);

            def listScratchOrgsCmd = 'sfdx force:data:soql:query -q "SELECT Name,OrgName,SignupUsername,SignupEmail,LastLoginDate,ExpirationDate FROM ActiveScratchOrg ORDER BY ExpirationDate ASC" -u '+this.devHubName+' --json' ;
            Utils.executeCommand(listScratchOrgsCmd, 'Query list of DevHub active scratch orgs');

            def activeScratchOrgsListRaw =   Utils.getCommandLogAsObj(listScratchOrgsCmd)

            def activeScratchOrgList = [] ;
            activeScratchOrgsListRaw.result.records.each {
                activeScratchOrgList << ['Name' : it['Name'], 'OrgName' : it['OrgName'],'SignupUsername': it['SignupUsername'], 'SignupEmail': it['SignupEmail'],'ExpirationDate': it['ExpirationDate']  ] ;
            }

            return activeScratchOrgList ;
        }



        // Check code consistency using PMD
        public checkCodeConsistency() {
            this.manageSelectSFDXProject()

            def elpse = Utils.startElapse('Check code consistency using PMD & CPD')

            // Avoid to run again apex checks if already performed
            Boolean doThePmdChecks = true
            if (this.jsonLog == true && Utils.getExternalValue(this.globalKeyPrefix,'checkApex') == 'success') {
                Utils.printlnLog('Skip check apex: already performed for global key '+this.globalKeyPrefix);
                Utils.stopElapse(elpse);
                this.jsonLogContent['pmdResults'] = [skipped: true, message: 'Already performed on a previous PR'] ;
                doThePmdChecks = false ;
            }

            //////////////////////////
            //// Code quality ////////
            //////////////////////////

            def pmdConfigDir = './Config/pmd'
            def sfdxWorkingDir = './'+this.projectDir+'/'+this.projectName+'/'+this.sfdxSourcesFolder
            def tmpDir = './'+this.projectDir+'/'+this.projectName+'/tmp'
            if (Utils.systemIsLinux())
                tmpDir = '/tmp' ;
            Utils.checkCreateDir(tmpDir)
            def pmdCacheDir = tmpDir+'/pmdcache'
            Utils.checkCreateDir(pmdCacheDir)
            def reportsDir = './'+this.projectDir+'/'+this.projectName+'/quality'
            Utils.checkCreateDir(reportsDir)

            def allFileErrors = []
            def basePmdCommand = (Utils.systemIsLinux() && this.pmdpath != '')?this.pmdpath+' pmd':'pmd'

                // Browse all pmd config files of config folder ( Config/pmd )
            if (doThePmdChecks) {
                def configfileList = []
                new AntBuilder().fileScanner {
                    fileset(dir: pmdConfigDir, includes: '**/**.xml')
                }.each { File f ->
                    configfileList << f
                }

                groovyx.gpars.GParsPool.withPool(1) {
                    configfileList.eachParallel { File f ->
                        // Perform the pmd analysis for the config file
                        def configFilePath = f.getAbsolutePath()
                        def configFileNm = f.getName()
                        def pmdCommand = ''

                        // Language management (only apex for now)
                        if (configFileNm.contains('apex'))
                            pmdCommand = basePmdCommand+' -dir '+sfdxWorkingDir+'/classes -language apex -rulesets '+configFilePath+' -cache '+pmdCacheDir+'/'+configFileNm+'.cache';

                        // If JSON requested, output is in XML in console, else generate human-reaadable HTML report files
                        if (this.jsonLog == true) {
                            pmdCommand+= ' -format xml'
                        }
                        else {
                            pmdCommand+= ' -format html -reportfile '+reportsDir+'/report-'+configFileNm.replace('.xml','')+'.html'
                        }

                        // Run analysis
                        def pmdCommandRes = Utils.executeCommand(pmdCommand,'PMD code check with config '+configFileNm,null,(this.jsonLog == true)?false:true)
                        def pmdCommandResLog = Utils.getCommandLog(pmdCommand)

                        // Manage logging
                        if (this.jsonLog == true) {
                            def pmdCommandResLogXmlRaw = '<?xml'+Utils.substringAfter(pmdCommandResLog.join('\n'),'<?xml')
                            def pmdCommandResLogXml = null ;
                            try {
                                pmdCommandResLogXml= new XmlSlurper().parseText(pmdCommandResLogXmlRaw).declareNamespace(pmd:'http://pmd.sourceforge.net/report/2.0.0');
                            } catch (def e) {
                                Utils.printlnLog('ERROR (1/) XmlSlurper parsing error with '+pmdCommandResLogXmlRaw);
                                Utils.printlnLog('ERROR (2/2) Full log: '+pmdCommandResLog);
                                throw e ;
                            }
                            if (pmdCommandResLogXml.'pmd:file' != null) {
                                pmdCommandResLogXml.'pmd:file'.collect { errFile ->
                                    def errFileNm = errFile.@name
                                    Utils.printlnLog('File: '+errFileNm)
                                    def errors = []
                                    errFile.violation.collect { violation ->
                                        String startPos = '('+violation.@beginline+','+violation.@begincolumn+')'
                                        String endPos = '('+violation.@endline+','+violation.@endcolumn+')'
                                        String errText = violation.text().replace('\n','').replace('\t','')
                                        String priority = violation.@priority
                                        String externalInfoUrl = violation.@externalInfoUrl
                                        String rule = violation.@rule
                                        def err = [ 'startPos': startPos,
                                                'endPos': endPos,
                                                'text': errText,
                                                'priority': priority,
                                                'externalInfoUrl': externalInfoUrl,
                                                'rule': rule
                                        ];
                                        errors.add(err)
                                        Utils.printlnLog('  From '+startPos+ ' to '+endPos+' : '+errText)
                                        Utils.printlnLog('  Priority: '+priority+', '+rule+' ('+externalInfoUrl+')')
                                        Utils.printlnLog();
                                    }
                                    def dtl = [:]
                                    dtl['file'] = String.valueOf(errFileNm)
                                    dtl['violations'] = errors
                                    allFileErrors.add(dtl)
                                    Utils.printlnLog();
                                }
                            }
                        }
                    }
                }

                if (this.jsonLog == true) {
                    this.jsonLogContent['pmdResults'] = [errorNb: allFileErrors.size(),
                                                        errorList :allFileErrors] ;
                }
                else {
                    Utils.printlnLog('PMD analysis report files are available in '+reportsDir)
                }

                // Store result in external variable if success
                if (allFileErrors.size() == 0) {
                    Utils.setExternalValue(this.globalKeyPrefix,'checkApex','success');
                }

            }
            //////////////////////////
            // Copy paste detector ///
            //////////////////////////

            def baseCpdCommand = (Utils.systemIsLinux() && this.pmdpath != '')?this.pmdpath+' cpd':'cpd'
            def allDuplicationErrors = []
            def summaryByLang = [:]

            def languageLs = ['apex','ecmascript']
            // Initialize results
            languageLs.each { lang ->
                summaryByLang[lang] = ['duplicationNb' : 0]
            }

            // Run copy paste checks in parallel processes for perfs
            groovyx.gpars.GParsPool.withPool(10) {
                languageLs.eachParallel {lang ->
                    // Language management
                    def langBrowsingFolder = ''
                    if (lang == 'apex')
                        langBrowsingFolder = sfdxWorkingDir+'/classes/'
                    else if (lang == 'ecmascript')
                        langBrowsingFolder = sfdxWorkingDir+'/aura/'

                    def cpdCommand = baseCpdCommand+' --files "'+langBrowsingFolder+'" --language '+lang+' --minimum-tokens '+this.cpdMinimumTokens;

                    // If JSON requested, output is in XML in console, else generate human-reaadable HTML report files
                    def logFileExt = ''
                    if (this.jsonLog == true) {
                        cpdCommand+= ' --format xml'
                        logFileExt = '.xml'
                    }
                    else {
                        cpdCommand+= ' --format text'
                        logFileExt = '.txt'
                    }

                    // Add CPD exclude file list in command
                    def languageCpdDef = Utils.getPropInJsonFile(this.cpdConfigFile,lang)
                    if (languageCpdDef != null && languageCpdDef['excludeFileList'] != null) {
                            Utils.printlnLog('Copy-Paste detector Exclude files :')
                            def excludeFileNameLs = []
                            languageCpdDef['excludeFileList'].each{ excludeFileDef ->
                                excludeFileNameLs << langBrowsingFolder+excludeFileDef.name
                                Utils.printlnLog('  -'+excludeFileDef.name+' :'+excludeFileDef.reason)
                            }
                            cpdCommand+= ' --exclude "'+excludeFileNameLs.join(',')+'"'
                            Utils.printlnLog()
                    }

                    // Run analysis
                    def cpdCommandRes = Utils.executeCommand(cpdCommand,'Copy-paste detector in '+lang,null,(this.jsonLog == true)?false:true)
                    def cpdCommandLog = Utils.getCommandLog(cpdCommand)

                    // Manage logging (visual)
                    def cpdOutputFile = new File(reportsDir+'/report-copy-paste-'+lang+logFileExt)
                    cpdOutputFile.text = cpdCommandLog.join('\n')
                    Utils.printlnLog('Wrote '+lang+' copy-paste results in '+cpdOutputFile.getAbsolutePath())

                    // Manage logging (json)
                    if (this.jsonLog == true) {
                        def cpdCommandResLogXmlRaw = '<?xml'+Utils.substringAfter(cpdCommandLog.join('\n'),'<?xml')

                        def cpdCommandResLogXml = null ;
                        try {
                             cpdCommandResLogXml= new XmlSlurper().parseText(cpdCommandResLogXmlRaw)
                        } catch (def e) {
                            Utils.printlnLog('ERROR (1/2) XmlSlurper parsing error with '+cpdCommandResLogXmlRaw);
                            Utils.printlnLog('ERROR (2/2) Full log: '+cpdCommandLog);
                            cpdCommandLog
                            throw e ;
                        }
                        if (cpdCommandResLogXml.'duplication' != null) {
                            cpdCommandResLogXml.'duplication'.collect { duplication ->
                                def lines = duplication.@lines
                                def tokens = duplication.@tokens
                                Utils.printlnLog('Lines number: '+lines+' , tokens: '+tokens)
                                def files = []
                                duplication.file.collect { file ->
                                    String line = file.@line
                                    String path = file.@path
                                    def err = [ 'line': line,
                                            'path': path
                                    ];
                                    files.add(err)
                                    Utils.printlnLog('  Line '+line+' ,path '+path)
                                }
                                def codefragment = duplication.codefragment.text()
                                Utils.printlnLog('  CODE :\n'+codefragment);

                                def dtl = [:]
                                dtl['language'] = lang
                                dtl['lines'] = String.valueOf(lines)
                                dtl['tokens'] = String.valueOf(tokens)
                                dtl['files'] = files

                                dtl['codefragment'] = codefragment
                                summaryByLang[lang]['duplicationNb']++
                                allDuplicationErrors.add(dtl)
                                Utils.printlnLog('\n==================================================================\n');
                            }
                        }
                    }
                }
            }

            if (this.jsonLog == true) {
                this.jsonLogContent['cpdResults'] = [duplicationNb: allDuplicationErrors.size(),
                                                    // duplicationList :allDuplicationErrors, do not output it for now, for lisibility
                                                    languageSummary: summaryByLang] ;
            }

            Utils.stopElapse(elpse);
        }

        // Check package consistency using https://github.com/forcedotcom/isvte-sfdx-plugin
        public checkPackageConsistency() {
            this.manageSelectSFDXProject()
            def elpse = Utils.startElapse('Check package consistency using https://github.com/forcedotcom/isvte-sfdx-plugin')

            // Convert sfdx project into metadatas
            this.metadatasDeployFolder = './tmp/'+String.valueOf((int)(Math.random()*1000000000))
            this.convertSfdxProjectToMetadata()

            // Filter metadatas to keep only the package.xml content
            this.metadatasDeployFolderOutput = metadatasDeployFolder+'_filtered'
            this.filterMetadatasBeforeDeploy()

            // Call svte-sfdx-plugin to get its results
            def isvTeCommand = 'sfdx isvte:mdscan -d .'+((this.jsonLog == true)?' --json':'' )
            def isvTeCommandRes = Utils.executeCommand(isvTeCommand,
                                                        'Check managed package metadatas consistency using isvte plugin',
                                                         './'+this.projectDir+'/'+this.projectName+'/'+this.metadatasDeployFolderOutput)
            def isvTeCommandLog = Utils.getCommandLog(isvTeCommand)
            assert isvTeCommandRes == true,  "[ERROR] isvte plugin failed"
            Utils.killDir('./'+this.projectDir+'/'+this.projectName+'/'+this.metadatasDeployFolderOutput);
            Utils.stopElapse(elpse);
        }

        public waitCommunityActive () {
            def res = UtilsSFDC.waitCommunityActive(this.url,this.timeoutInSeconds);
            assert res == true,  "[ERROR] URL "+this.url+" was not active when timeout was reached ("+this.timeoutInSeconds+")" ;
        }

        public runAutomatedTestingToolOnScratch() {
            this.manageSelectSFDXProject();
            this.manageSelectScratchOrg(false);

            def username = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user");
            if (username == null) {
                def orgInfo = this.getOrgInfo(this.scratchOrgAlias);
                username = orgInfo.username ;
                Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_user",username);
            }
            def password = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_pwd");
            if (password == null) {
                this.generateScratchOrgUserPassword()
                password = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_pwd");
            }

            def communitiesBaseUrl = Utils.getPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_communities_base_url");
            if (communitiesBaseUrl == null && new File("./Scripts/apex/getCommunitiesBaseUrl.apex").exists()) {
                this.executeSingleApexCodeFile("./Scripts/apex/getCommunitiesBaseUrl.apex")
                communitiesBaseUrl = this.jsonLogContent['getCommunitiesBaseUrl.apex'].returnValue ;
                Utils.setPropInJsonFile(this.ownConfigFile,"${this.scratchOrgAlias}_communities_base_url",communitiesBaseUrl);
            }
            def playerCmd = "lelamanul-player -CONFIG_FILE config_Player_jenkins_generic.ini -SFDC_USERNAME \"${username}\" -SFDC_PASSWORD \"${password}\" -TEST_BASE_URL ${communitiesBaseUrl} -COMMANDS_FILE_FOLDER ./PlayerScripts";
            Utils.executeCommand(playerCmd,'Run automated testing tool with scratch org info','./PlayerScripts')
        }

}
