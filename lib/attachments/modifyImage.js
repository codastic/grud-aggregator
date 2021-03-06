"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.modifyImages = modifyImages;

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _child_process = require("child_process");

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function modifyImages() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
    chunkSize: 1,
    imageWidth: "auto",
    imageHeight: "auto",
    minify: false,
    dataDirectory: "out",
    outPath: "out",
    progress: function progress() {}
  },
      _ref$chunkSize = _ref.chunkSize,
      chunkSize = _ref$chunkSize === undefined ? 1 : _ref$chunkSize,
      _ref$imageWidth = _ref.imageWidth,
      imageWidth = _ref$imageWidth === undefined ? "auto" : _ref$imageWidth,
      _ref$imageHeight = _ref.imageHeight,
      imageHeight = _ref$imageHeight === undefined ? "auto" : _ref$imageHeight,
      database = _ref.database,
      key = _ref.key,
      _ref$minify = _ref.minify,
      minify = _ref$minify === undefined ? false : _ref$minify,
      _ref$outPath = _ref.outPath,
      outPath = _ref$outPath === undefined ? "out" : _ref$outPath,
      _ref$progress = _ref.progress,
      progress = _ref$progress === undefined ? function () {} : _ref$progress;

  if (_lodash2.default.isEmpty(key)) {
    throw new Error("Missing key option");
  }

  if (_lodash2.default.isEmpty(database)) {
    throw new Error("Missing database option");
  }

  return function (images) {
    if (!_lodash2.default.isArray(images)) {
      throw new Error("Expected Array as images");
    }

    var inputs = _lodash2.default.map(images, function (i) {
      return {
        fromPath: i,
        toPath: outPath + "/" + _path2.default.basename(i)
      };
    });
    var resize = imageWidth !== "auto" || imageHeight !== "auto";
    var steps = inputs.length;

    return Promise.resolve({
      currentStep: 0,
      files: inputs
    }).then(function (stepAndFiles) {
      progress({
        error: false,
        message: "Modifying images",
        currentStep: stepAndFiles.currentStep,
        steps: steps
      });
      return stepAndFiles;
    }).then(function (stepAndFiles) {
      if (resize || minify) {
        // resize can resize AND minify at the same time
        return _lodash2.default.reduce(_lodash2.default.chunk(stepAndFiles.files, chunkSize), function (promise, chunkFiles) {
          return promise.then(function (status) {

            var doing = resize && minify ? "Resizing and minifying" : resize ? "Resizing" : "Minifying";
            var multiple = chunkSize > 1;

            progress({
              error: false,
              message: doing + " image" + (multiple ? "s" : "") + " " + _lodash2.default.map(chunkFiles, function (file) {
                return file.fromPath;
              }).join(", "),
              currentStep: status.currentStep,
              steps: steps
            });

            var filesInChunkWithStatus = _lodash2.default.map(chunkFiles, function (file) {
              var to = file.toPath;
              if (database.find(_path2.default.basename(to), key)) {
                return {
                  done: true,
                  fromPath: file.fromPath,
                  toPath: to
                };
              } else {
                return {
                  done: false,
                  fromPath: file.fromPath,
                  toPath: to
                };
              }
            });

            return Promise.all(_lodash2.default.map(filesInChunkWithStatus, function (file) {
              if (file.done) {
                return Promise.resolve(file);
              } else if (resize) {
                // resize (and maybe minify)
                return startImageModificationProcess([file.fromPath, file.toPath, minify, imageWidth, imageHeight]).then(function () {
                  return file;
                });
              } else {
                // only minify
                return startImageModificationProcess([file.fromPath, file.toPath, minify]).then(function () {
                  return file;
                });
              }
            })).then(function () {
              return Promise.all(_lodash2.default.map(filesInChunkWithStatus, function (file) {
                database.insert(_path2.default.basename(file.toPath), key);
              })).then(function () {
                return database.save();
              }).then(function () {
                return {
                  files: status.files.concat(_lodash2.default.map(filesInChunkWithStatus, function (file) {
                    return _lodash2.default.omit(file, "done");
                  })),
                  currentStep: status.currentStep + filesInChunkWithStatus.length
                };
              });
            });
          });
        }, Promise.resolve({
          currentStep: stepAndFiles.currentStep,
          files: []
        }));
      } else {
        return stepAndFiles;
      }
    }).then(function (stepAndFiles) {
      progress({
        error: false,
        message: "Modified images",
        currentStep: steps,
        steps: steps
      });
      var modifiedFiles = _lodash2.default.map(stepAndFiles.files, function (file) {
        database.insert(_path2.default.basename(file.toPath), key);
        return file.toPath;
      });

      return database.save().then(function () {
        return modifiedFiles;
      });
    });
  };
}

function startImageModificationProcess(args) {
  return new Promise(function (resolve, reject) {
    var cp = (0, _child_process.fork)(__dirname + "/modifyImageProcess.js", args);

    cp.on("close", function (code) {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Could not modify image with args"));
      }
    });
  });
}