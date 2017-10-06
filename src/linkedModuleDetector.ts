//helper to find a sub-hierarchy of fs-linked modules from a list, including real fs locations

import fs = require("fs");
import path = require("path");
import _=require("underscore")
import index = require("./index");

function detectModulesInFolder(folder : string, modulesToDetect : {[name:string] : index.DetectedModule},
                               parent : index.DetectedModule) {

    var nodeModulesFolder = path.join(folder, "node_modules");
    if (!fs.existsSync(nodeModulesFolder)) nodeModulesFolder = folder;

    subDirectories(nodeModulesFolder).forEach(subDirectory=>{
        var fullSubdirPath = path.join(nodeModulesFolder, subDirectory);

        var subModule = moduleFromFolder(fullSubdirPath, modulesToDetect);
        
        if (subModule) {
            subModule.fsLocation = fs.realpathSync(fullSubdirPath);

            if (parent) {
                if (!parent.dependencies) {
                    parent.dependencies = [];
                }

                if (!_.find(parent.dependencies, dependency=>dependency.name == subModule.name)) {
                    parent.dependencies.push(subModule)
                }
            }

            detectModulesInFolder(fullSubdirPath, modulesToDetect, subModule);
        }
    })
}

export function getModules(rootFolder : string, workspaceDescriptorFile: string) : index.DetectedModule[] {

    var result : index.DetectedModule[] = [];

    var modulesMap = loadModulesStaticInfo(workspaceDescriptorFile);
    var rootModule = moduleFromFolder(rootFolder, modulesMap);
    if (rootModule) {
        rootModule.fsLocation = fs.realpathSync(rootFolder);
    }

    detectModulesInFolder(rootFolder, modulesMap, rootModule);

    Object.keys(modulesMap).forEach(moduleName=>{
        result.push(modulesMap[moduleName]);
    })

    return result;
}

export function moduleFromFolder(folder : string, modulesToDetect : {[name:string] : index.DetectedModule}) : index.DetectedModule {
    var moduleFolderName = path.basename(folder);
    var moduleName = getModuleName(folder);

    var module = null;
    if (moduleFolderName && modulesToDetect[moduleFolderName]) {
        module = modulesToDetect[moduleFolderName];
    } else if (moduleName && modulesToDetect[moduleName]) {
        module = modulesToDetect[moduleName];
    }

    return module;
}

function getModuleName(rootModulePath : string) : string {
    var packageJsonPath = path.join(rootModulePath, "package.json");
    if (!fs.existsSync(packageJsonPath)) return null;

    var packageJsonContents = fs.readFileSync(packageJsonPath).toString();

    var config = JSON.parse(packageJsonContents);

    return config.name;
}

export function subDirectories(folder : string) : string[] {
    return fs.readdirSync(folder).filter(childName => {
        return fs.statSync(path.join(folder, childName)).isDirectory();
    });
}

export function loadModulesStaticInfo(workspaceDescriptor: string) : {[name:string] : index.DetectedModule} {

    if(!path.isAbsolute(workspaceDescriptor)){
        workspaceDescriptor = path.resolve(process.cwd(),workspaceDescriptor);
    }

    var modulesListContent = fs.readFileSync(workspaceDescriptor).toString();

    var list = JSON.parse(modulesListContent);

    var result : {[name:string] : index.DetectedModule} = {};
    Object.keys(list).forEach(moduleName => {
        var obj = list[moduleName];

        var branch = null;
        if (obj.gitBranch) {
            branch = obj.gitBranch;
        } else if (typeof(obj.gitBranch) == "boolean") {
            branch = null;
        } else {
            branch = "master";
        }

        var module = {
            name : moduleName,
            buildCommand : obj.build,
            testCommand : obj.test,
            gitUrl: obj.gitUrl,
            gitBranch: branch,
            installTypings:(obj.installTypings?obj.installTypings:false)
        }

        result[moduleName] = <index.DetectedModule>module;
    })

    return result;
}


