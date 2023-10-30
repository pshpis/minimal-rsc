const React = require('react');

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED = Symbol.for(
  'react.default_value'
);

const PENDING = 'pending';
const BLOCKED = 'blocked';
const RESOLVED_MODEL = 'resolved_model';
const RESOLVED_MODULE = 'resolved_module';
const INITIALIZED = 'fulfilled';
const ERRORED = 'rejected'; // $FlowFixMe[missing-this-annot]

const ReactSharedInternals =
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

const ContextRegistry = ReactSharedInternals.ContextRegistry;
function getOrCreateServerContext(globalName) {
  if (!ContextRegistry[globalName]) {
    ContextRegistry[globalName] = React.createServerContext(
      globalName, // $FlowFixMe[incompatible-call] function signature doesn't reflect the symbol value
      REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED
    );
  }

  return ContextRegistry[globalName];
}

const asyncModuleCache = new Map();
const chunkCache = new Map();
const knownServerReferences = new WeakMap();

function noServerCall() {
  throw new Error(
    'Server Functions cannot be called during initial render. ' +
      'This would create a fetch waterfall. Try to use a Server Component ' +
      'to pass data to Client Components instead.'
  );
}

function missingCall() {
  throw new Error(
    'Trying to call a function from "use server" but the callServer option ' +
      'was not implemented in your router runtime.'
  );
}

function close(response) {
  // In case there are any remaining unresolved chunks, they won't
  // be resolved now. So we need to issue an error to those.
  // Ideally we should be able to early bail out if we kept a
  // ref count of pending chunks.
  reportGlobalError(response, new Error('Connection closed.'));
}

function Chunk(status, value, reason, response) {
  this.status = status;
  this.value = value;
  this.reason = reason;
  this._response = response;
}

let initializingChunk = null;
let initializingChunkBlockedModel = null;

function initializeModelChunk(chunk) {
  const prevChunk = initializingChunk;
  const prevBlocked = initializingChunkBlockedModel;
  initializingChunk = chunk;
  initializingChunkBlockedModel = null;

  try {
    const value = JSON.parse(chunk.value, chunk._response._fromJSON);

    if (
      initializingChunkBlockedModel !== null &&
      initializingChunkBlockedModel.deps > 0
    ) {
      initializingChunkBlockedModel.value = value; // We discovered new dependencies on modules that are not yet resolved.
      // We have to go the BLOCKED state until they're resolved.

      const blockedChunk = chunk;
      blockedChunk.status = BLOCKED;
      blockedChunk.value = null;
      blockedChunk.reason = null;
    } else {
      const initializedChunk = chunk;
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = value;
    }
  } catch (error) {
    const erroredChunk = chunk;
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  } finally {
    initializingChunk = prevChunk;
    initializingChunkBlockedModel = prevBlocked;
  }
}

Chunk.prototype = Object.create(Promise.prototype); // TODO: This doesn't return a new Promise chain unlike the real .then

Chunk.prototype.then = function(resolve, reject) {
  const chunk = this; // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.

  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;

    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  } // The status might have changed after initialization.

  switch (chunk.status) {
    case INITIALIZED:
      resolve(chunk.value);
      break;

    case PENDING:
    case BLOCKED:
      if (resolve) {
        if (chunk.value === null) {
          chunk.value = [];
        }

        chunk.value.push(resolve);
      }

      if (reject) {
        if (chunk.reason === null) {
          chunk.reason = [];
        }

        chunk.reason.push(reject);
      }

      break;

    default:
      reject(chunk.reason);
      break;
  }
};
function wakeChunk(listeners, value) {
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i];
    listener(value);
  }
}
function triggerErrorOnChunk(chunk, error) {
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) {
    // We already resolved. We didn't expect to see this.
    return;
  }

  const listeners = chunk.reason;
  const erroredChunk = chunk;
  erroredChunk.status = ERRORED;
  erroredChunk.reason = error;

  if (listeners !== null) {
    wakeChunk(listeners, error);
  }
}

function reportGlobalError(response, error) {
  response._chunks.forEach(function(chunk) {
    // If this chunk was already resolved or errored, it won't
    // trigger an error but if it wasn't then we need to
    // because we won't be getting any new data to resolve it.
    if (chunk.status === PENDING) {
      triggerErrorOnChunk(chunk, error);
    }
  });
}

const decoderOptions = {
  stream: true,
};

function readFinalStringChunk(decoder, buffer) {
  return decoder.decode(buffer);
}
function readPartialStringChunk(decoder, buffer) {
  return decoder.decode(buffer, decoderOptions);
}

function processBinaryChunk(response, chunk) {
  const stringDecoder = response._stringDecoder;
  let linebreak = chunk.indexOf(10); // newline

  while (linebreak > -1) {
    const fullrow =
      response._partialRow +
      readFinalStringChunk(stringDecoder, chunk.subarray(0, linebreak));
    processFullRow(response, fullrow);
    response._partialRow = '';
    chunk = chunk.subarray(linebreak + 1);
    linebreak = chunk.indexOf(10); // newline
  }

  response._partialRow += readPartialStringChunk(stringDecoder, chunk);
}

function resolveErrorDev(response, id, digest, message, stack) {
  var error = new Error(
    message ||
      'An error occurred in the Server Components render but no message was provided'
  );
  error.stack = stack;
  error.digest = digest;
  var errorWithDigest = error;
  var chunks = response._chunks;
  var chunk = chunks.get(id);

  if (!chunk) {
    chunks.set(id, createErrorChunk(response, errorWithDigest));
  } else {
    triggerErrorOnChunk(chunk, errorWithDigest);
  }
}

function processFullRow(response, row) {
  if (row === '') {
    return;
  }

  var colon = row.indexOf(':', 0);
  var id = parseInt(row.substring(0, colon), 16);
  var tag = row[colon + 1]; // When tags that are not text are added, check them here before
  // parsing the row as text.
  // switch (tag) {
  // }

  switch (tag) {
    case 'I': {
      resolveModule(response, id, row.substring(colon + 2));
      return;
    }

    case 'E': {
      var errorInfo = JSON.parse(row.substring(colon + 2));

      {
        resolveErrorDev(
          response,
          id,
          errorInfo.digest,
          errorInfo.message,
          errorInfo.stack
        );
      }

      return;
    }

    default: {
      // We assume anything else is JSON.
      resolveModel(response, id, row.substring(colon + 1));
      return;
    }
  }
}

function startReadingFromStream(response, stream) {
  const reader = stream.getReader();

  function progress(_ref) {
    const done = _ref.done,
      value = _ref.value;

    if (done) {
      close(response);
      return;
    }

    processBinaryChunk(response, value);
    return reader
      .read()
      .then(progress)
      .catch(error);
  }

  function error(e) {
    reportGlobalError(response, e);
  }

  reader
    .read()
    .then(progress)
    .catch(error);
}

function getChunk(response, id) {
  const chunks = response._chunks;
  let chunk = chunks.get(id);

  if (!chunk) {
    chunk = createPendingChunk(response);
    chunks.set(id, chunk);
  }

  return chunk;
}

function getRoot(response) {
  return getChunk(response, 0);
}

function createPendingChunk(response) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(PENDING, null, null, response);
}

function requireModule(metadata) {
  let moduleExports;

  if (metadata.async) {
    // We assume that preloadModule has been called before, which
    // should have added something to the module cache.
    const promise = asyncModuleCache.get(metadata.id);

    if (promise.status === 'fulfilled') {
      moduleExports = promise.value;
    } else {
      throw promise.reason;
    }
  } else {
    moduleExports = __webpack_require__(metadata.id);
  }

  if (metadata.name === '*') {
    // This is a placeholder value that represents that the caller imported this
    // as a CommonJS module as is.
    return moduleExports;
  }

  if (metadata.name === '') {
    // This is a placeholder value that represents that the caller accessed the
    // default property of this if it was an ESM interop module.
    return moduleExports.__esModule ? moduleExports.default : moduleExports;
  }

  return moduleExports[metadata.name];
}

function initializeModuleChunk(chunk) {
  try {
    const value = requireModule(chunk.value);
    const initializedChunk = chunk;
    initializedChunk.status = INITIALIZED;
    initializedChunk.value = value;
  } catch (error) {
    const erroredChunk = chunk;
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  }
}

function readChunk(chunk) {
  // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.
  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;

    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  } // The status might have changed after initialization.

  switch (chunk.status) {
    case INITIALIZED:
      return chunk.value;

    case PENDING:
    case BLOCKED:
      // eslint-disable-next-line no-throw-literal
      throw chunk;

    default:
      throw chunk.reason;
  }
}

function createElement(type, key, props) {
  const element = {
    // This tag allows us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,
    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: null,
    props: props,
    // Record the component responsible for creating this element.
    _owner: null,
  };

  {
    // We don't really need to add any of these but keeping them for good measure.
    // Unfortunately, _store is enumerable in jest matchers so for equality to
    // work, I need to keep it or make _store non-enumerable in the other file.
    element._store = {};
    Object.defineProperty(element._store, 'validated', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: true, // This element has already been validated on the server.
    });
    Object.defineProperty(element, '_self', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: null,
    });
    Object.defineProperty(element, '_source', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: null,
    });
  }

  return element;
}

function createLazyChunkWrapper(chunk) {
  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: chunk,
    _init: readChunk,
  };
}

function createServerReferenceProxy(response, metaData) {
  const callServer = response._callServer;

  const proxy = function() {
    // $FlowFixMe[method-unbinding]
    const args = Array.prototype.slice.call(arguments);
    const p = metaData.bound;

    if (!p) {
      return callServer(metaData.id, args);
    }

    if (p.status === INITIALIZED) {
      const bound = p.value;
      return callServer(metaData.id, bound.concat(args));
    } // Since this is a fake Promise whose .then doesn't chain, we have to wrap it.
    // TODO: Remove the wrapper once that's fixed.

    return Promise.resolve(p).then(function(bound) {
      return callServer(metaData.id, bound.concat(args));
    });
  };

  knownServerReferences.set(proxy, metaData);
  return proxy;
}

function createModelResolver(chunk, parentObject, key) {
  let blocked;

  if (initializingChunkBlockedModel) {
    blocked = initializingChunkBlockedModel;
    blocked.deps++;
  } else {
    blocked = initializingChunkBlockedModel = {
      deps: 1,
      value: null,
    };
  }

  return function(value) {
    parentObject[key] = value;
    blocked.deps--;

    if (blocked.deps === 0) {
      if (chunk.status !== BLOCKED) {
        return;
      }

      const resolveListeners = chunk.value;
      const initializedChunk = chunk;
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = blocked.value;

      if (resolveListeners !== null) {
        wakeChunk(resolveListeners, blocked.value);
      }
    }
  };
}

function createModelReject(chunk) {
  return function(error) {
    return triggerErrorOnChunk(chunk, error);
  };
}

function parseModelString(response, parentObject, key, value) {
  if (value[0] === '$') {
    if (value === '$') {
      // A very common symbol.
      return REACT_ELEMENT_TYPE;
    }

    switch (value[1]) {
      case '$': {
        // This was an escaped string value.
        return value.substring(1);
      }

      case 'L': {
        // Lazy node
        const id = parseInt(value.substring(2), 16);
        const chunk = getChunk(response, id); // We create a React.lazy wrapper around any lazy values.
        // When passed into React, we'll know how to suspend on this.

        return createLazyChunkWrapper(chunk);
      }

      case '@': {
        // Promise
        const _id = parseInt(value.substring(2), 16);

        return getChunk(response, _id);
      }

      case 'S': {
        // Symbol
        return Symbol.for(value.substring(2));
      }

      case 'P': {
        // Server Context Provider
        return getOrCreateServerContext(value.substring(2)).Provider;
      }

      case 'F': {
        // Server Reference
        const _id2 = parseInt(value.substring(2), 16);

        const _chunk2 = getChunk(response, _id2);

        switch (_chunk2.status) {
          case RESOLVED_MODEL:
            initializeModelChunk(_chunk2);
            break;
        } // The status might have changed after initialization.

        switch (_chunk2.status) {
          case INITIALIZED: {
            const metadata = _chunk2.value;
            return createServerReferenceProxy(response, metadata);
          }

          default:
            throw _chunk2.reason;
        }
      }

      case 'u': {
        // matches "$undefined"
        // Special encoding for `undefined` which can't be serialized as JSON otherwise.
        return undefined;
      }

      case 'n': {
        // BigInt
        return BigInt(value.substring(2));
      }

      default: {
        // We assume that anything else is a reference ID.
        const _id3 = parseInt(value.substring(1), 16);

        const _chunk3 = getChunk(response, _id3);

        switch (_chunk3.status) {
          case RESOLVED_MODEL:
            initializeModelChunk(_chunk3);
            break;

          case RESOLVED_MODULE:
            initializeModuleChunk(_chunk3);
            break;
        } // The status might have changed after initialization.

        switch (_chunk3.status) {
          case INITIALIZED:
            return _chunk3.value;

          case PENDING:
          case BLOCKED:
            const parentChunk = initializingChunk;

            _chunk3.then(
              createModelResolver(parentChunk, parentObject, key),
              createModelReject(parentChunk)
            );

            return null;

          default:
            throw _chunk3.reason;
        }
      }
    }
  }

  return value;
}
function parseModelTuple(response, value) {
  const tuple = value;

  if (tuple[0] === REACT_ELEMENT_TYPE) {
    // TODO: Consider having React just directly accept these arrays as elements.
    // Or even change the ReactElement type to be an array.
    return createElement(tuple[1], tuple[2], tuple[3]);
  }

  return value;
}

function createStringDecoder() {
  return new TextDecoder();
}

function createResponse$1(bundlerConfig, callServer) {
  const chunks = new Map();
  return {
    _bundlerConfig: bundlerConfig,
    _callServer: callServer !== undefined ? callServer : missingCall,
    _chunks: chunks,
  };
}

function createFromJSONCallback(response) {
  // $FlowFixMe[missing-this-annot]
  return function(key, value) {
    if (typeof value === 'string') {
      // We can't use .bind here because we need the "this" value.
      return parseModelString(response, this, key, value);
    }

    if (typeof value === 'object' && value !== null) {
      return parseModelTuple(response, value);
    }

    return value;
  };
}

function createResponse(bundlerConfig, callServer) {
  // NOTE: CHECK THE COMPILER OUTPUT EACH TIME YOU CHANGE THIS.
  // It should be inlined to one object literal but minor changes can break it.
  const stringDecoder = createStringDecoder();
  const response = createResponse$1(bundlerConfig, callServer);
  response._partialRow = '';

  {
    response._stringDecoder = stringDecoder;
  } // Don't inline this call because it causes closure to outline the call above.

  response._fromJSON = createFromJSONCallback(response);
  return response;
}

function createResponseFromOptions(options) {
  return createResponse(
    options && options.moduleMap ? options.moduleMap : null,
    noServerCall
  );
}

function createFromReadableStream(stream, options) {
  const response = createResponseFromOptions(options);
  startReadingFromStream(response, stream);
  return getRoot(response);
}

function createFromFetch(promiseForResponse, options) {
  const response = createResponseFromOptions(options);
  promiseForResponse.then(
    function(r) {
      startReadingFromStream(response, r.body);
    },
    function(e) {
      reportGlobalError(response, e);
    }
  );
  return getRoot(response);
}
