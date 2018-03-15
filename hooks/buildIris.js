const fs = require('fs-extra');
const path = require('path');
const spawn = require('child_process').spawn;
const replace = require('replace-in-files');

function waitForExit(spawn) {
    return new Promise((resolve, reject) => {
        spawn.stderr.pipe(process.stderr);
        spawn.stdout.pipe(process.stdout);

        spawn.on('exit', code => {
            if (code !== 0) {
                return reject("Command failed.");
            }
            return resolve();
        });
    });
}

/**
 * Builds the main Iris source and copies it into the cordova app.
 * @param context Cordova Build context, see https://cordova.apache.org/docs/de/latest/guide/appdev/hooks/
 */
module.exports = function(context) {
    const root = context.opts.projectRoot;
    const src = path.resolve(root, './iris_src');
    const www = path.resolve(root, 'www');

    const opts = {cwd: src};

    // 1. Check file existence
    return fs.exists(path.resolve(src, './node_modules'))
        .then(exists => {
            if (!exists) {
                throw new Error("Iris not found. Please update the Git submodule for iris_src and run npm install.");
            }

            // 2. Clean www
            console.log("==> Clean www");
            return fs.emptyDir(www);
        })
        .then(() => {
            return fs.ensureFile(path.resolve(www, '.gitkeep'))
        })
        .then(() => {
            // 3. npm run prod-nowatch
            console.log("==> Iris: Building...");
            return waitForExit(spawn('npm', ['run', 'prod-nowatch'], opts));
        })
        .then(() => {
            // 4. Copy
            console.log("==> Iris: Copying...");
            return fs.copy(path.resolve(src, 'mopidy_iris', 'static'), path.resolve(root, 'www'));
        })
        .then(() => {
            // 5. Patches
            console.log("==> Iris: Applying additional patches...");
            // 5.1. Fix absolute URLs in index.html
            return replace({
                files: path.resolve(root, 'www', 'index.html'),
                from: /\/iris\//g,
                to: "./",
            })
        });
};