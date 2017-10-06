import moduleUtils = require("./linkedModuleDetector")
import devUtils = require("./devUtils")
import path = require("path");
import fs = require("fs");
import utils = require("./exportedUtils")
import index = require("./index");

function getModuleGitFolderName(module : index.DetectedModule) : string {
    var lastSlashPos = module.gitUrl.lastIndexOf("/");
    var gitExtPos = module.gitUrl.lastIndexOf(".git");
    if (gitExtPos == -1) gitExtPos = module.gitUrl.length;

    var moduleName = module.gitUrl.substr(lastSlashPos+1, gitExtPos - lastSlashPos - 1);
    return moduleName;
}

function getExistingModules(folder : string, modulesToTest: {[name:string] : index.DetectedModule})
    : {[name:string] : index.DetectedModule} {

    if (!fs.existsSync(folder)) return {};

    var result : {[name:string] : index.DetectedModule} = {}

    moduleUtils.subDirectories(folder).forEach(subDirectory=>{
        var absolutePath = path.join(folder,subDirectory);
        var module = moduleUtils.moduleFromFolder(absolutePath, modulesToTest);
        if (module) {
            module.fsLocation = absolutePath;
            result[module.name] = module;
        }
    });

    return result;
}

function findModulePath(folder : string, module: index.DetectedModule): string {

    if (!fs.existsSync(folder)) return null;

    var modules : {[name:string] : index.DetectedModule} = {}
    modules[module.name] = module;

    moduleUtils.subDirectories(folder).forEach(subDirectory=>{
        var absolutePath = path.join(folder,subDirectory);
        var module = moduleUtils.moduleFromFolder(absolutePath, modules);
        if (module) {
            module.fsLocation = absolutePath;
        }
    });

    return module.fsLocation;
}

/**
 * Clones repositories to a subfolders of a folder, returns list of repositories absolute paths
 * @param rootPath
 * @param module
 */
function cloneRepositories(rootPath : string, modules: {[name:string] : index.DetectedModule}) : string[] {

    if(!path.isAbsolute(rootPath)){
        rootPath = path.resolve(process.cwd(),rootPath);
    }

    var existingModules = getExistingModules(rootPath, modules);

    var result : string[] = [];

    Object.keys(modules).forEach(moduleName=>{
        var module = modules[moduleName];
        var modulePath = path.join(rootPath, getModuleGitFolderName(module));
        if (fs.existsSync(modulePath)) {

            console.log("Module " + moduleName + " already exists at " +
                modulePath + ", skip cloning");

            result.push(modulePath);

            checkoutBranch(modulePath, module);

            return;
        }

        if (existingModules[moduleName]) {
            //handling the case when module folder does not match what git usually clones to (renamed folder).
            var realPath = existingModules[moduleName].fsLocation;

            console.log("Module " + moduleName + " already exists at " +
                realPath + ", skip cloning");

            result.push(realPath);

            checkoutBranch(realPath, module);
            
            return;
        }

        var cloneCommand = null;
        if (module.gitBranch) {
            cloneCommand = "git clone " + module.gitUrl + " --branch " + module.gitBranch + " --single-branch";
        } else {
            cloneCommand = "git clone " + module.gitUrl;
        }

        if(utils.execProcess(cloneCommand, rootPath, true) != 0) {
            console.log("Failed to clone repository " + module.gitUrl + " : " + module.gitBranch);
            return;
        }
        var clonedModulePath = findModulePath(rootPath, module);
        if (!clonedModulePath) {
            console.log("Cloned module " + module.name + " does not match its name");
        } else {
            result.push(clonedModulePath);
        }
    })

    return result;
}

function checkoutBranch(path : string, module : index.DetectedModule) {
    if (!module) return;

    if (!module.gitBranch) return;

    var cloneCommand = "git checkout " + module.gitBranch;
    if(utils.execProcess(cloneCommand, path, true) != 0) {
        console.log("Failed to checkout branch : " + module.gitBranch);
    }
}

function registerNPMModules(repositoryRoots : string[]) {

    repositoryRoots.forEach(moduleFolder=>{
        if(utils.execProcess("npm link", moduleFolder, true) != 0){
            throw new Error("Could not npm link " + moduleFolder)
        }
    })
}

function npmInstall(repositoryRoots : string[]) {

    repositoryRoots.forEach(moduleFolder=>{
        if(utils.execProcess("npm install", moduleFolder, true) != 0) {
            throw new Error("Could not npm install " + moduleFolder)
        }
    })
}

function installTypings(repositoryRoots : string[], modules: {[name:string] : index.DetectedModule}) {

    repositoryRoots.forEach(moduleFolder=>{
        var module = moduleUtils.moduleFromFolder(moduleFolder, modules);
        if (module && module.installTypings) {
            if (utils.execProcess("typings install", moduleFolder, true) != 0) {
                throw new Error("Could not install typings " + moduleFolder)
            }
        }
    })
}

function deleteFolderRecursive(folder : string) {
    if(fs.existsSync(folder) ) {
        if(fs.lstatSync(folder).isSymbolicLink()){
            fs.unlinkSync(folder);
            return;
        }
        fs.readdirSync(folder).forEach(fileName=>{
            var childPath = path.join(folder, fileName);
            if(fs.lstatSync(childPath).isDirectory()) {
                deleteFolderRecursive(childPath);
            } else {
                fs.unlinkSync(childPath);
            }
        });

        fs.rmdirSync(folder);
    }
};

function replaceDependenciesWithLinks(repositoryRoots : string[],
                                      modules: {[name:string] : index.DetectedModule}) {
    repositoryRoots.forEach(repositoryRoot=>{
        let nodeModulesDir = path.join(repositoryRoot, "node_modules");
        if (!fs.existsSync(nodeModulesDir)) {
            fs.mkdir(nodeModulesDir);
        }

        moduleUtils.subDirectories(nodeModulesDir).forEach(subDirectoryName=>{
            let subDirectoryAbsolutePath = path.join(nodeModulesDir, subDirectoryName);

            if (fs.realpathSync(subDirectoryAbsolutePath) != subDirectoryAbsolutePath) return;

            let module = moduleUtils.moduleFromFolder(subDirectoryAbsolutePath, modules);
            if (!module) return;

            deleteFolderRecursive(subDirectoryAbsolutePath)

            if(utils.execProcess("npm link " + module.name, nodeModulesDir, true) != 0) {
                throw new Error("Could not npm link " + module.name + " in " + nodeModulesDir);
            }
        });
    });
}

function replaceDependenciesWithDirectSymlinks(repositoryRoots : string[],
                                      modules: {[name:string] : index.DetectedModule}) {

    let repositoryMap:any = {};
    for(var repositoryRoot of repositoryRoots){
        repositoryMap[path.basename(repositoryRoot)] = repositoryRoot;
    }

    for(var repositoryRoot of repositoryRoots){
        let nodeModulesDir = path.join(repositoryRoot, "node_modules");
        if (!fs.existsSync(nodeModulesDir)) {
            fs.mkdirSync(nodeModulesDir);
        }
        
        let packageJsonPath = path.resolve(repositoryRoot,"package.json");
        if(!fs.existsSync(packageJsonPath)){
            continue;
        }
        let packageJson:any;
        try{
            packageJson = JSON.parse(fs.readFileSync(packageJsonPath,"utf8"));
        }
        catch(e){
            console.log("Failed to read " + packageJsonPath + ":");
            console.log(e);
            continue;
        }
        let dependencies = packageJson['dependencies'];
        let optDependencies = packageJson['optionalDependencies'];
        if(!dependencies && ! optDependencies){
            continue;
        }
        dependencies = dependencies || {};
        optDependencies = optDependencies || {};

        for(var moduleName of Object.keys(modules)) {

            if(!dependencies[moduleName]&&!optDependencies[moduleName]){
                continue;
            }

            let dependencyPath = path.resolve(nodeModulesDir,moduleName);
            let module = modules[moduleName];
            let moduleRepoName = getModuleGitFolderName(module);
            let repoPath = repositoryMap[moduleRepoName];
            if(repoPath){
                deleteFolderRecursive(dependencyPath);
                utils.createSymlink(repoPath,dependencyPath);
            }
        }
    }
}

function setupModules(
    repositoryRoots : string[],
    modules: {[name:string] : index.DetectedModule},
    useDirectSymlinks:boolean) {

    if(!useDirectSymlinks) {
        registerNPMModules(repositoryRoots);
    }

    npmInstall(repositoryRoots);

    installTypings(repositoryRoots, modules);

    if(useDirectSymlinks){
        replaceDependenciesWithDirectSymlinks(repositoryRoots, modules);
    }
    else {
        replaceDependenciesWithLinks(repositoryRoots, modules);
    }
}

export function setUp(rootFolder : string, workspaceDescriptorFile : string, useSymlinks=false) {

    let staticModulesMap = moduleUtils.loadModulesStaticInfo(workspaceDescriptorFile);

    let repositoryRoots = cloneRepositories(rootFolder, staticModulesMap);

    repositoryRoots.forEach(repositoryRoot=>console.log("Reporoot: " + repositoryRoot));
    setupModules(repositoryRoots, staticModulesMap,useSymlinks);
}

export function createSymlinks(rootFolder : string, workspaceDescriptorFile : string) {

    let staticModulesMap = moduleUtils.loadModulesStaticInfo(workspaceDescriptorFile);

    let repositoryRoots = cloneRepositories(rootFolder, staticModulesMap);

    repositoryRoots.forEach(repositoryRoot=>console.log("Reporoot: " + repositoryRoot));
    replaceDependenciesWithDirectSymlinks(repositoryRoots, staticModulesMap);
}
