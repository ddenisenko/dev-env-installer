import modulesDetector = require("./linkedModuleDetector");
import utils = require("./exportedUtils");

export function pullAll(rootFolder: string, workspaceDescriptorFile: string) {
    var modules = modulesDetector.getModules(rootFolder, workspaceDescriptorFile);

    var reversedModules = modules.reverse();

    reversedModules.forEach(module=>{
        var folder = module.fsLocation;
        if (folder) {
            if(utils.execProcess("git pull", folder, true) != 0) {
                throw new Error("Failed to pull " + folder)
            }
        }
    })
}

export function buildAll(rootFolder: string, workspaceDescriptorFile: string) {
    var modules = modulesDetector.getModules(rootFolder, workspaceDescriptorFile);

    var reversedModules = modules.reverse();

    reversedModules.forEach(module=>{
        var folder = module.fsLocation;
        if (folder) {
            var buildCommand = module.buildCommand;
            if (buildCommand) {
                if(utils.execProcess(buildCommand, folder, true) != 0) {
                    throw new Error("Failed to build " + folder)
                }
            }
        }
    })
}

export function testAll(rootFolder: string, workspaceDescriptorFile: string) {
    var modules = modulesDetector.getModules(rootFolder, workspaceDescriptorFile);

    var reversedModules = modules.reverse();

    reversedModules.forEach(module=>{
        var folder = module.fsLocation;
        if (folder) {
            var testCommand = module.testCommand;
            if (testCommand) {
                if(utils.execProcess(testCommand, folder, true) != 0) {
                    throw new Error("Tests failed in " + folder)
                }
            }
        }
    })
}
