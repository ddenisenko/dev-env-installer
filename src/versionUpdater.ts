/// <reference path="../typings/main.d.ts" />
import fs = require('fs');
import exec = require('child_process');

export class VersionUpdater{

    getNewVersion(data){
        var module = data.module;
        var dependencies = module.dependencies;
        var repoPath: string = module.fsLocation;

        var gitStateChecker = new GitHelper();
        var isDepricated : boolean = gitStateChecker.isDeprecated(repoPath);
        var hasUpdatedDependencies : boolean = false;

        var packageJson : any = JSON.parse(<string><any>fs.readFileSync(repoPath + '/package.json'));

        if (dependencies) {
            for (var i = 0; i < dependencies.length; i++) {
                if (!data.packages[dependencies[i].name]) {
                    data.module = dependencies[i];
                    this.getNewVersion(data);
                    hasUpdatedDependencies = dependencies[i].isDepricated;
                }
            }
        }
        if (hasUpdatedDependencies || isDepricated) {
            module.isDepricated = isDepricated;
            module.newVersion = this.incVersion(packageJson.version);
        }

        if (!data.packages[module.name]){
            data.packages[module.name] = module;
        }

        return data;
    }

    updateVersion(data){
        var module = data.module;
        if (module.isDepricated) {
            var repoPath:string = module.fsLocation;
            var packageJson:any = JSON.parse(<string><any>fs.readFileSync(repoPath + '/package.json'));

            packageJson.version = module.newVersion;
            var dependencyKeys = Object.keys(packageJson.dependencies);
            for (var i = 0; i < dependencyKeys.length; i++){
                var packageItem = data.packages[dependencyKeys[i]];
                if (packageItem) {
                    var prefix : string = "";
                    if (packageJson.dependencies[dependencyKeys[i]].startsWith("^")){
                        prefix = "^";
                    }
                    packageJson.dependencies[dependencyKeys[i]] = prefix + packageItem.newVersion;
                }
            }
            fs.writeFileSync(repoPath + '/package.json', JSON.stringify(packageJson, null, 4));
        }
        return data;
    }

    incVersion(rawVersion : string) : string{
        var version : string = rawVersion.match(/(\d+\.*)+/)[0];
        var incVersion : string;
        var separator : string = ".";
        var lastPart : number = parseInt(version.substr(version.lastIndexOf(separator) + separator.length));
        lastPart = lastPart+1;
        incVersion = version.substring(0, version.lastIndexOf(separator) + separator.length) + lastPart;
        return incVersion;
    }

    publish(module){
        var gitHelper = new GitHelper();
        var packageJson:any = JSON.parse(<string><any>fs.readFileSync(module.fsLocation + '/package.json'));
        var versionMessage : string = "v" + packageJson.version;
        var commitCommand : string = "cd " + module.fsLocation + " && git commit -a -m \"" + versionMessage + "\"";
        var pushCommand : string = "cd " + module.fsLocation + " && git tag \"" + versionMessage + "\" && git push origin --all && git push origin --tags";
        var publishCommand : string = "cd " + module.fsLocation + " && npm publish";

        gitHelper.executeCommand(commitCommand);
        if (gitHelper.isDeprecated(module.fsLocation) || module.isDepricated) {
            gitHelper.executeCommand(pushCommand);
            gitHelper.executeCommand(publishCommand);
        }
    }

    runDry(module){
        var gitHelper = new GitHelper();
        var packageJson:any = JSON.parse(<string><any>fs.readFileSync(module.fsLocation + '/package.json'));
        var versionMessage : string = "v" + packageJson.version;
        console.log("\n");
        if (module.isDepricated) {
            console.log("Module: '" + module.name + "' will be published with version: " + packageJson.version + "\nIf to execute 'dev-env-installer updateVersions' version will be updated to " + module.newVersion);
            if (module.dependencies){
                for (var i = 0; i< module.dependencies.length; i++){
                    var dependencyJson:any = JSON.parse(<string><any>fs.readFileSync(module.dependencies[i].fsLocation + '/package.json'));
                    console.log("\t Dependency: '" + module.dependencies[i].name + "' will be updated to the version " + dependencyJson.version + "\n\t    If to execute 'dev-env-installer updateVersions' version will be updated to " + module.dependencies[i].newVersion);
                }
            }
        }
    }
}

export class GitHelper{
    executeCommand(command : string) : string{
        var commandResult : string;
        try {
            commandResult = <string><any>exec.execSync(command,
                (error, stdout, stderr) => {
                    if (stderr !== null) {
                        console.log(`stderr: ${stderr}`);
                    }
                    if (error !== null) {
                        console.log(`exec error: ${error}`);
                    }
                }).toString();
        } catch (e){
        }
        return commandResult;
    }

    getLastTag(repoPath) : string{
        var tag : string = this.executeCommand("cd " + repoPath + " && git describe --abbrev=0 --tags");
        if(!tag){
            console.log("Warning: Repository has no tags");
        }
        return tag;
    }

    getTagCommit(repoPath, tagName) : string{
        var commit : string ="";
        if(repoPath && tagName) {
            var commitInfo: string = this.executeCommand("cd " + repoPath + " && git show " + tagName);
            var commitInfoLines : string[] = commitInfo.split(/\n/g);
            for (var i = 0; i < commitInfoLines.length; i++) {
                if (commitInfoLines[i].match(/^commit \w+/)) {
                    commit = commitInfoLines[i].substring(7);
                    break;
                }
            }
        }
        return commit;
    }

    getLastRepoCommit(repoPath) : string{
        var repoCommits : string = this.executeCommand("cd " + repoPath + " && git log -1");
        if (repoCommits) {
            var repoCommitsLines:string[] = repoCommits.split(/\n/g);
            var lastCommit:string;
            for (var i = 0; i < repoCommitsLines.length; i++) {
                if (repoCommitsLines[i].match(/^commit \w+/)) {
                    lastCommit = repoCommitsLines[i].substring(7);
                    break;
                }
            }
        }
        return lastCommit;
    }

    public isDeprecated(repoPath : string) : boolean{
        var lastTag : string = this.getLastTag(repoPath);
        var lastTagCommit : string = this.getTagCommit(repoPath, lastTag);
        var lastRepoCommit : string = this.getLastRepoCommit(repoPath);
        var compareResult : number = lastRepoCommit.localeCompare(lastTagCommit);
        if (compareResult == 0)
            return false;
        else
            return true;
    }
}
