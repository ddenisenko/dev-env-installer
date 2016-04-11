#!/usr/bin/env node

import path = require("path");
import fs = require("fs");
import devUtils = require("./devUtils")
import installer = require("./devEnvInstaller")

var workspaceDescriptorFileName = "workspace.json";

function getCliArgumentByName(argumentName : string) {
    for(var i = 0 ; i < process.argv.length ; i++){
        if(process.argv[i]==argumentName && i < process.argv.length-1){
            return process.argv[i+1];
        }
    }

    return null;
}

function findWorkspaceRoot() {
    var cliWorkspaceArg = getCliArgumentByName("--workspace");
    if (cliWorkspaceArg) {
        return cliWorkspaceArg;
    }

    var potentialPackageJsonPath = path.join(__dirname, "../../../package.json");
    if (fs.existsSync(potentialPackageJsonPath)) {
        return path.join(path.dirname(potentialPackageJsonPath), "../");
    }

    return __dirname;
}

function findWorkspaceDescriptor(workspaceRoot : string) {

    var cliDescriptorArg = getCliArgumentByName("--descriptor");
    if (cliDescriptorArg) {
        return cliDescriptorArg;
    }

    var potentialDescriptorPath1 = path.join(__dirname, workspaceDescriptorFileName);
    if (fs.existsSync(potentialDescriptorPath1)) {
        return potentialDescriptorPath1;
    }

    var potentialDescriptorPath2 = path.join(workspaceRoot, workspaceDescriptorFileName);
    if (fs.existsSync(potentialDescriptorPath2)) {
        return potentialDescriptorPath2;
    }

    var potentialDescriptorPath3 = path.join(__dirname, "../../../",workspaceDescriptorFileName);
    if (fs.existsSync(potentialDescriptorPath3)) {
        return potentialDescriptorPath3;
    }

    console.log("Specify workspace descriptor JSON file argument with --descriptor key, or put the file into a current or workspace directory");
    return null;
}

if (process.argv[2]) {
    var workspaceRoot = findWorkspaceRoot();

    var workspaceDescriptor = findWorkspaceDescriptor(workspaceRoot);

    if (workspaceRoot && workspaceDescriptor) {
        console.log("Workspace root is: " + workspaceRoot);
        console.log("Workspace descriptor is: " + workspaceDescriptor);

        switch (process.argv[2]) {
            case("pullall"):
                devUtils.pullAll(workspaceRoot, workspaceDescriptor);
                break;
            case ("buildall"):
                devUtils.buildAll(workspaceRoot, workspaceDescriptor);
                break;
            case ("testall"):
                devUtils.testAll(workspaceRoot, workspaceDescriptor);
                break;
            case ("install"):
                installer.setUp(workspaceRoot, workspaceDescriptor);
                break;
            default:
                console.log("Command required, one of: pullall, buildall, testall, install");
        }
    }
} else {
    console.log("Command required, one of: pullall, buildall, testall, install");
}