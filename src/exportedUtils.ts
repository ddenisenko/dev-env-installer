import cp = require('child_process')
import fs = require("fs");
import path = require("path");
import index = require("./index");
import modulesDetector = require("./linkedModuleDetector");

export function execProcess(
    command:string,
    wrkDir:string,
    logEnabled:boolean = false,
    errLogEnabled:boolean = true,
    messageBefore:string = '',
    messageAfter:string = '',
    messageError:string = '',
    maxLogLength:number=-1,onError:(err)=>void=null) : number
{
    console.log("> "+wrkDir + " " + command)
    try {
        if (logEnabled) {
            console.log(messageBefore)
        }
        var logObj = cp.execSync(
            command,
            {
                cwd: wrkDir,
                encoding: 'utf8',
                stdio: [0,1,2]
            });

        if (logEnabled) {
            console.log(messageAfter);
            if (logObj) {
                var log = logObj.toString();
                if(log.trim().length>0) {
                    if (maxLogLength < 0) {
                        console.log(log)
                    }
                    else if (maxLogLength > 0) {
                        console.log(log.substring(0, Math.min(maxLogLength, log.length)))
                    }
                }
            }
        }

        return 0;
    }
    catch (err) {
        if (onError){
            onError(err);
        }
        if (errLogEnabled) {
            console.log(messageError)
            console.log(err.message)
        }

        return err.status;
    }
}


export function getCliArgumentByName(argumentName : string) {
    for(var i = 0 ; i < process.argv.length ; i++){
        if(process.argv[i]==argumentName && i < process.argv.length-1){
            return process.argv[i+1];
        }
    }

    return null;
}

export function hasCliArgument(argumentName : string, mustHaveValue=false) {
    for(var i = 0 ; i < process.argv.length ; i++){
        if(process.argv[i]==argumentName){
            if(mustHaveValue){
                return i < process.argv.length-1;
            }
            return true;
        }
    }
    return false;
}

export function createSymlink(absoluteSrc:string, absoluteDst:string){

    if(isWindows()){
        let linkCommand = `mklink /J "${absoluteDst}" "${absoluteSrc}"`;
        if (execProcess(linkCommand, path.dirname(absoluteDst), true) != 0) {
            throw new Error(`Could not create symlink link: '${linkCommand}'`);
        }
    }
    else{
        fs.symlinkSync(absoluteSrc,absoluteDst);
        console.log(`Symlink created from '${absoluteSrc}' to '${absoluteDst}'`);
    }
}

export function isWindows():boolean{
    let osId = process.platform;
    return osId.indexOf("win") == 0;
}

export function loadModulesStaticInfo(workspaceDescriptor: string) : {[name:string] : index.DetectedModule} {
    return modulesDetector.loadModulesStaticInfo(workspaceDescriptor);
}
