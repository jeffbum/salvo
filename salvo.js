#! /usr/bin/env node

'use strict';

const program = require('commander');
const _ = require('lodash');
const fs = require('fs');
const cmd = require('node-cmd');
const Promise = require('bluebird');
const Client = require('node-rest-client').Client;
const rClient = new Client();
const util = require('util');
const xml2js = require('xml2js');
const xmlBuilder = new xml2js.Builder();
const xmlParser = new xml2js.Parser();

const storedValues = {
  datetimeRun: new Date().valueOf(),
  access_token:'TEMPORARY_TOKEN'
}
const extractData = ((extractionData, method, extractionModifiers) => {
  let extractedData = null;
  if (method === 'string') {
    extractedData = extractionData;
  }
  if (method === 'object') {
    extractedData = extractionModifiers.source === '$$all$$' ? extractionData : _.get(extractionData, extractionModifiers.source);
  }
  if (method === 'array') {
    extractedData = extractionModifiers.source === '$$all$$' ? extractionData : extractionData[extractionModifiers.source];
  }
  if (method === 'regex') {
    // There is an assumption that the first index will just be the match, and everything else is the capture
    const capRegex = new RegExp(extractionModifiers.source);
    const capturedRegex = capRegex.exec(extractionData);
    extractedData = capturedRegex;
    if (capturedRegex) {
      extractedData = extractionModifiers.regexIndex ? capturedRegex[extractionModifiers.regexIndex] : capturedRegex;
    }
  }
  if (extractionModifiers.forceType) {
    const forceType = extractionModifiers.forceType;
    if (forceType.toLowerCase() === 'number') {
      return Number(extractedData);
    }
    if (forceType.toLowerCase() === 'string') {
      return extractedData.toString();
    }
  }
  return extractedData;
});

const captureData = (action, respSet) => {
  console.log(`RESPSET: ${JSON.stringify(respSet, 0, 2)}`);
  const data = (typeof respSet).toLowerCase() === 'object' ? respSet[0] : respSet;
    for (const captureItem of action.capture) {
      // First, we get the proper data
      let foundData = null;
      foundData = extractData(data, captureItem.type, captureItem.extractionModifiers || { source: captureItem.source });

      // Now that the data is set, we save it
      if (captureItem.captureType === 'set') {
        if (captureItem.type === 'object') {
          // This logic is used as to assign multiple properties to a complex object captureItem
          const objectWithProperties = {};
          for (const itemValue of captureItem.values) {
            objectWithProperties[itemValue.key] = extractData(data, itemValue.type, itemValue.extractionModifiers);
          }
          storedValues[captureItem.target] = objectWithProperties;
        } else {
          storedValues[captureItem.target] = foundData;
        }
      }
      if (captureItem.captureType === 'push') {
        if (!storedValues[captureItem.target]) {
          storedValues[captureItem.target] = [];
        }
        storedValues[captureItem.target].push(foundData);
      }
      console.log(`STORED VALUES \r\n ${util.inspect(storedValues)}`);
    }
  return true;
};

const updateVar = ((path, data, action) => {

  if (action === 'increment') {
    if (typeof storedValues[path] === 'string') {
      storedValues[path] = storedValues[path].toString() + data;
    } else {
      storedValues[path] = Number(storedValues[path]) + data;
    }
  }

  if (action === 'push') {
    if (!storedValues[path]) {
      storedValues[path] = [];
    }
    storedValues[path].push(data);
  }
  if (action === 'set') {
    storedValues[path] = data;
  }
});

const makeRestCall = callProps => {
  const requestArgs = {
    data: callProps.data, // data passed to REST method (only useful in POST, PUT or PATCH methods)
    path: callProps.path, // path substitution var
    parameters: callProps.parameters, // this is serialized as URL parameters
    headers: callProps.headers // request headers
  };

  return new Promise(callFinished => {
    if (callProps.method.toLowerCase() === 'get') {
      return rClient.get(callProps.target, requestArgs, (data, response) => {
    //    console.log(`CALL DATA get= ${data}`);
        return callFinished([data, response]);
      });
    }
    return rClient.post(callProps.target, requestArgs, (data, response) => {
  //        console.log(`CALL DATA get= ${JSON.stringify(data)}`);
      return callFinished([data, response]);
    });
  })
  .then(responseSet => {
    return responseSet;
  });
};

const substituteValues = object => {
  for (let objProp in object) {
    if ((typeof object[objProp]).toLowerCase() === 'object') {
      objProp = substituteValues(object[objProp]);
    } else if (typeof object[objProp] === 'string') {
      const valKeys = Object.keys(storedValues);
      for (let zz = 0; zz < valKeys.length; ++zz) {
        const matchWord = valKeys[zz];
        const storedValue = typeof storedValues[matchWord] === 'object' ? JSON.stringify(storedValues[matchWord]) : storedValues[matchWord];
        const wIndex = object[objProp].indexOf('}>}' + matchWord + '{<{');
        if (wIndex != -1) {
        //  console.log(`match found in string ${object[objProp]} \r\n for word ${matchWord}`);
          object[objProp] = object[objProp].replace('}>}' + matchWord + '{<{', storedValue);
        //  console.log(`replaced string ${object[objProp]} \r\n for word ${matchWord}`);
        }
      }
    }
  }
};

const runAction = (actions, callback, _runCount) => {
    const runCount = _runCount || 0;
    const action = actions[runCount];
    const backupAction = JSON.parse(JSON.stringify(action));
    substituteValues(action);
    return new Promise(preDelay => {
      setTimeout(function () {
        console.log(`Pre-action delay finished for ${action.name}`);
        // Execute action depending on type
        preDelay();
      }, action.pre_delay);
    })
    .then(() => {
      return new Promise(actionPromise => {
        if (action.type === 'terminal') {
          let terminalCommand = action.values.text;
          if (action.values.arguments && action.values.arguments.length > 0) {
            // Check for and assign arguments
            for (let zz = 0; zz < action.values.arguments.length; ++zz) {
              terminalCommand += ' ' + action.values.arguments[zz].key + action.values.arguments[zz].value;
            }
          }
          console.log(`TERMINAL COMMAND: ${terminalCommand}`);
          return cmd.get(terminalCommand, (err, resp) => {
            console.log(`action res:${JSON.stringify(action)} `);
            console.log(`NODE res:${(resp)} `);
            if (action.capture && action.capture.length > 0) {
              captureData(action, resp);
            }
            return actionPromise();
          });
        }

        if (action.type === 'set-var') {
          updateVar(action.values.target, action.values.data, action.values.action);
          return actionPromise();
        }

        if (action.type === 'web-call') {
          return makeRestCall(action.values)
          .then(resp => {
            captureData(action, resp);
            return actionPromise();
          });
        }
        if (action.type === 'make-file') {
          return new Promise(resolve2 => {
            let writeData = action.values.data;
            const dataOperations = _.map(action.values.dataOperations, op => {
              return op.toLowerCase();
            });

            if (dataOperations.indexOf('jsonstringify') > -1) {
              writeData = JSON.stringify(writeData);
            }
            return fs.writeFile(`${process.cwd()}/${action.values.fileLocation}`, writeData, () => {
              return resolve2();
            });
          })
          .then(() => {
            return actionPromise();
          });
        }
        if (action.type === 'update-file') {
          return new Promise(resolve2 => {
            const dataOperations = _.map(action.values.dataOperations, op => {
              return op.toLowerCase();
            });
            if (!fs.existsSync(`${process.cwd()}/${action.values.fileLocation}`)) {
              console.log(`Exiting this step early, as the file does not exist at location : \r\n ${process.cwd()}/${action.values.fileLocation}`);
            }
            return new Promise(resolveRead => {
              return fs.readFile(`${process.cwd()}/${action.values.fileLocation}`, 'utf8', (err, readData) => {
                if (err) {
                  return false;
                }
                let writeData = readData || '';
            //    console.log(readData);
                if (dataOperations.indexOf('jsonstringify') > -1) {
                  writeData = JSON.stringify(readData);
                }

                if (action.values.fileType.toLowerCase() === 'xml') {
                  return xmlParser.parseString(readData, (err, parsedXML) => {
                    if (err) {
                      console.log(`Error reading file:  ${err}`);
                      return resolveRead(false);
                    }
                    for (let zz = 0; zz < action.values.data.length; ++zz) {
                      const dataToInsert = action.values.data[zz];
                      _.set(parsedXML, dataToInsert.path, dataToInsert.value);
                    }
                    return resolveRead(xmlBuilder.buildObject(parsedXML));
                  });
                }
              // Assumes text if no other type is supplied
                for (let zz = 0; zz < action.values.data.length; ++zz) {
                  writeData += action.values.data[zz];
                }
                return resolveRead(writeData);
              });
            })
            .then(writeData => {
              if (!writeData) {
                resolve2();
              }
              console.log(`DATA TO  WRITE \r\n ${writeData}`);
              return fs.writeFile(`${process.cwd()}/${action.values.fileLocation}`, writeData, () => {
                return resolve2();
              });
            });
          })
          .then(() => {
            return actionPromise();
          });
        }
        return actionPromise();
      })
      .then(() => {
        setTimeout(function() {
          console.log(`Post-delay finished for ${action.name}`);
          if (runCount < actions.length - 1) {
            actions[runCount] = backupAction;
            return runAction(actions, callback, runCount + 1)
          }
          else {
            return callback();
          }
        }, action.post_delay);
      });
    });
};

const runOperation = (operation, callback, _runCount) => {
  const runCount = _runCount || 0;
  if (runCount >= operation.iterations) {
    return setTimeout(function() {
      console.log(`Finished operation delay for ${operation.name}`);
      callback();
    }, operation.post_delay_op);
  }
  setTimeout(function () {
    console.log(`Finished pre-loop delay for ${operation.name}`)
  return new Promise(iterationFinished => {
    runAction(operation.actions, iterationFinished, 0);
  })
  .then(() => {
    setTimeout(function() {
      console.log(`Finished post delay(loop) for operation ${operation.name}`);
      if (runCount < operation.iterations) {
        return runOperation(operation, callback, runCount + 1);
      }
      callback();
    }, operation.post_delay_loop);
  });
  }, operation.pre_delay_loop);
};

program
  .version('0.0.1')
  .option('-t, --target <target>', 'Define target')
  .parse(process.argv);

if (!program.target) {
  console.log('No salvo file specified.  Please provide a relative file path with the -t parameter');
  process.exit();
}

const salvoScript = require(`${process.cwd()}/${program.target}`);
// Requires format -t './filename'
console.log(`Beginning salvo ${salvoScript.name}`);

return Promise.map(salvoScript.preloads, preloadFile => {
  // Loads each pre-salvo file.  Format requires './filename'
  return require(preloadFile);
})
.then(loadedFiles => {
  console.log(`Loaded values: ${JSON.stringify(loadedFiles)}`);
  return new Promise(resolve => {

    for (const loadedData of loadedFiles) {
      let dataObject = loadedData;
      if (loadedData.hasOwnProperty('default')) {
        // File was a JS file so properties are accessed through default property
        dataObject = loadedData.default;
      }
      for (const key of Object.keys(dataObject)) {
        storedValues[key] = dataObject[key];
      }
    }
//    console.log(`preserved values: ${JSON.stringify(storedValues)}`);
    resolve();
  })
  .then(() => {
    // Preload values are loaded in and now we can begin operations
    return Promise.each(salvoScript.operations, operation => {
      // Handle each operation in turn
      console.log(`Beginning operation ${operation.name}`);
      return new Promise(opResolve => {
        // Make a promise to handle pre-operation timing delay in each object
        setTimeout(() => {
          // The following code executes after the pre-operation delay
          console.log(`Finished pre-operation delay on ${operation.name}`);
            // Run once for each iteration
          runOperation(operation, opResolve);
        }, operation.pre_delay_op);
      });
    })
    .then(() => {
      console.log('All ops finished');
      process.exit();
    });
  });
});
