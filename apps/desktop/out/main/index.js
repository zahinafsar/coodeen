"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const require$$0$1 = require("path");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_path = require("node:path");
const require$$0$2 = require("child_process");
const require$$0 = require("fs");
const promises = require("node:fs/promises");
const node_os = require("node:os");
const createSseClient = ({ onSseError, onSseEvent, responseTransformer, responseValidator, sseDefaultRetryDelay, sseMaxRetryAttempts, sseMaxRetryDelay, sseSleepFn, url, ...options }) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3e3;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== void 0) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const response = await fetch(url, { ...options, headers, signal });
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            void reader.cancel();
          } catch {
          }
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split("\n");
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join("\n");
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== void 0 && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 3e4);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};
const getAuthToken = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};
const jsonBodySerializer = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
const separatorArrayExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
const separatorArrayNoExplode = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
const separatorObjectExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
const serializeArrayParam = ({ allowReserved, explode, name, style, value }) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
const serializePrimitiveParam = ({ allowReserved, name, value }) => {
  if (value === void 0 || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren’t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
const serializeObjectParam = ({ allowReserved, explode, name, style, value, valueOnly }) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
const PATH_PARAM_RE = /\{[^{}]+\}/g;
const defaultPathSerializer = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === void 0 || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
const getUrl = ({ baseUrl: baseUrl2, path, query, querySerializer, url: _url }) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl2 ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
const createQuerySerializer = ({ allowReserved, array, object } = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === void 0 || value === null) {
          continue;
        }
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam({
            allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam({
            allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam({
            allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
const getParseAs = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
const checkForExistence = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
const setAuthParams = async ({ security, ...options }) => {
  for (const auth of security) {
    if (checkForExistence(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
const buildUrl = (options) => getUrl({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer(options.querySerializer),
  url: options.url
});
const mergeConfigs = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders(a.headers, b.headers);
  return config;
};
const mergeHeaders = (...headers) => {
  const mergedHeaders = new Headers();
  for (const header of headers) {
    if (!header || typeof header !== "object") {
      continue;
    }
    const iterator = header instanceof Headers ? header.entries() : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== void 0) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};
class Interceptors {
  _fns;
  constructor() {
    this._fns = [];
  }
  clear() {
    this._fns = [];
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this._fns[id] ? id : -1;
    } else {
      return this._fns.indexOf(id);
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return !!this._fns[index];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this._fns[index]) {
      this._fns[index] = null;
    }
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this._fns[index]) {
      this._fns[index] = fn;
      return id;
    } else {
      return false;
    }
  }
  use(fn) {
    this._fns = [...this._fns, fn];
    return this._fns.length - 1;
  }
}
const createInterceptors = () => ({
  error: new Interceptors(),
  request: new Interceptors(),
  response: new Interceptors()
});
const defaultQuerySerializer = createQuerySerializer({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
const defaultHeaders = {
  "Content-Type": "application/json"
};
const createConfig = (override = {}) => ({
  ...jsonBodySerializer,
  headers: defaultHeaders,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer,
  ...override
});
const createClient = (config = {}) => {
  let _config = mergeConfigs(createConfig(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders(_config.headers, options.headers),
      serializedBody: void 0
    };
    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.serializedBody === void 0 || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: opts.serializedBody
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request._fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response = await _fetch(request2);
    for (const fn of interceptors.response._fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        return opts.responseStyle === "data" ? {} : {
          data: {},
          ...result
        };
      }
      const parseAs = (opts.parseAs === "auto" ? getParseAs(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "json":
        case "text":
          data = await response[parseAs]();
          break;
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {
    }
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error._fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? void 0 : {
      error: finalError,
      ...result
    };
  };
  const makeMethod = (method) => {
    const fn = (options) => request({ ...options, method });
    fn.sse = async (options) => {
      const { opts, url } = await beforeRequest(options);
      return createSseClient({
        ...opts,
        body: opts.body,
        headers: opts.headers,
        method,
        url
      });
    };
    return fn;
  };
  return {
    buildUrl,
    connect: makeMethod("CONNECT"),
    delete: makeMethod("DELETE"),
    get: makeMethod("GET"),
    getConfig,
    head: makeMethod("HEAD"),
    interceptors,
    options: makeMethod("OPTIONS"),
    patch: makeMethod("PATCH"),
    post: makeMethod("POST"),
    put: makeMethod("PUT"),
    request,
    setConfig,
    trace: makeMethod("TRACE")
  };
};
const client$1 = createClient(createConfig({
  baseUrl: "http://localhost:4096"
}));
class _HeyApiClient {
  _client = client$1;
  constructor(args) {
    if (args?.client) {
      this._client = args.client;
    }
  }
}
class Global extends _HeyApiClient {
  /**
   * Get events
   */
  event(options) {
    return (options?.client ?? this._client).get.sse({
      url: "/global/event",
      ...options
    });
  }
}
class Project extends _HeyApiClient {
  /**
   * List all projects
   */
  list(options) {
    return (options?.client ?? this._client).get({
      url: "/project",
      ...options
    });
  }
  /**
   * Get the current project
   */
  current(options) {
    return (options?.client ?? this._client).get({
      url: "/project/current",
      ...options
    });
  }
}
class Pty extends _HeyApiClient {
  /**
   * List all PTY sessions
   */
  list(options) {
    return (options?.client ?? this._client).get({
      url: "/pty",
      ...options
    });
  }
  /**
   * Create a new PTY session
   */
  create(options) {
    return (options?.client ?? this._client).post({
      url: "/pty",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Remove a PTY session
   */
  remove(options) {
    return (options.client ?? this._client).delete({
      url: "/pty/{id}",
      ...options
    });
  }
  /**
   * Get PTY session info
   */
  get(options) {
    return (options.client ?? this._client).get({
      url: "/pty/{id}",
      ...options
    });
  }
  /**
   * Update PTY session
   */
  update(options) {
    return (options.client ?? this._client).put({
      url: "/pty/{id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Connect to a PTY session
   */
  connect(options) {
    return (options.client ?? this._client).get({
      url: "/pty/{id}/connect",
      ...options
    });
  }
}
class Config extends _HeyApiClient {
  /**
   * Get config info
   */
  get(options) {
    return (options?.client ?? this._client).get({
      url: "/config",
      ...options
    });
  }
  /**
   * Update config
   */
  update(options) {
    return (options?.client ?? this._client).patch({
      url: "/config",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * List all providers
   */
  providers(options) {
    return (options?.client ?? this._client).get({
      url: "/config/providers",
      ...options
    });
  }
}
class Tool extends _HeyApiClient {
  /**
   * List all tool IDs (including built-in and dynamically registered)
   */
  ids(options) {
    return (options?.client ?? this._client).get({
      url: "/experimental/tool/ids",
      ...options
    });
  }
  /**
   * List tools with JSON schema parameters for a provider/model
   */
  list(options) {
    return (options.client ?? this._client).get({
      url: "/experimental/tool",
      ...options
    });
  }
}
class Instance extends _HeyApiClient {
  /**
   * Dispose the current instance
   */
  dispose(options) {
    return (options?.client ?? this._client).post({
      url: "/instance/dispose",
      ...options
    });
  }
}
class Path extends _HeyApiClient {
  /**
   * Get the current path
   */
  get(options) {
    return (options?.client ?? this._client).get({
      url: "/path",
      ...options
    });
  }
}
class Vcs extends _HeyApiClient {
  /**
   * Get VCS info for the current instance
   */
  get(options) {
    return (options?.client ?? this._client).get({
      url: "/vcs",
      ...options
    });
  }
}
class Session extends _HeyApiClient {
  /**
   * List all sessions
   */
  list(options) {
    return (options?.client ?? this._client).get({
      url: "/session",
      ...options
    });
  }
  /**
   * Create a new session
   */
  create(options) {
    return (options?.client ?? this._client).post({
      url: "/session",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Get session status
   */
  status(options) {
    return (options?.client ?? this._client).get({
      url: "/session/status",
      ...options
    });
  }
  /**
   * Delete a session and all its data
   */
  delete(options) {
    return (options.client ?? this._client).delete({
      url: "/session/{id}",
      ...options
    });
  }
  /**
   * Get session
   */
  get(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}",
      ...options
    });
  }
  /**
   * Update session properties
   */
  update(options) {
    return (options.client ?? this._client).patch({
      url: "/session/{id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Get a session's children
   */
  children(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}/children",
      ...options
    });
  }
  /**
   * Get the todo list for a session
   */
  todo(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}/todo",
      ...options
    });
  }
  /**
   * Analyze the app and create an AGENTS.md file
   */
  init(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/init",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Fork an existing session at a specific message
   */
  fork(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/fork",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Abort a session
   */
  abort(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/abort",
      ...options
    });
  }
  /**
   * Unshare the session
   */
  unshare(options) {
    return (options.client ?? this._client).delete({
      url: "/session/{id}/share",
      ...options
    });
  }
  /**
   * Share a session
   */
  share(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/share",
      ...options
    });
  }
  /**
   * Get the diff for this session
   */
  diff(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}/diff",
      ...options
    });
  }
  /**
   * Summarize the session
   */
  summarize(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/summarize",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * List messages for a session
   */
  messages(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}/message",
      ...options
    });
  }
  /**
   * Create and send a new message to a session
   */
  prompt(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/message",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Get a message from a session
   */
  message(options) {
    return (options.client ?? this._client).get({
      url: "/session/{id}/message/{messageID}",
      ...options
    });
  }
  /**
   * Create and send a new message to a session, start if needed and return immediately
   */
  promptAsync(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/prompt_async",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Send a new command to a session
   */
  command(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/command",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Run a shell command
   */
  shell(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/shell",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Revert a message
   */
  revert(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/revert",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Restore all reverted messages
   */
  unrevert(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/unrevert",
      ...options
    });
  }
}
class Command extends _HeyApiClient {
  /**
   * List all commands
   */
  list(options) {
    return (options?.client ?? this._client).get({
      url: "/command",
      ...options
    });
  }
}
class Oauth extends _HeyApiClient {
  /**
   * Authorize a provider using OAuth
   */
  authorize(options) {
    return (options.client ?? this._client).post({
      url: "/provider/{id}/oauth/authorize",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Handle OAuth callback for a provider
   */
  callback(options) {
    return (options.client ?? this._client).post({
      url: "/provider/{id}/oauth/callback",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
}
class Provider extends _HeyApiClient {
  /**
   * List all providers
   */
  list(options) {
    return (options?.client ?? this._client).get({
      url: "/provider",
      ...options
    });
  }
  /**
   * Get provider authentication methods
   */
  auth(options) {
    return (options?.client ?? this._client).get({
      url: "/provider/auth",
      ...options
    });
  }
  oauth = new Oauth({ client: this._client });
}
class Find extends _HeyApiClient {
  /**
   * Find text in files
   */
  text(options) {
    return (options.client ?? this._client).get({
      url: "/find",
      ...options
    });
  }
  /**
   * Find files
   */
  files(options) {
    return (options.client ?? this._client).get({
      url: "/find/file",
      ...options
    });
  }
  /**
   * Find workspace symbols
   */
  symbols(options) {
    return (options.client ?? this._client).get({
      url: "/find/symbol",
      ...options
    });
  }
}
class File extends _HeyApiClient {
  /**
   * List files and directories
   */
  list(options) {
    return (options.client ?? this._client).get({
      url: "/file",
      ...options
    });
  }
  /**
   * Read a file
   */
  read(options) {
    return (options.client ?? this._client).get({
      url: "/file/content",
      ...options
    });
  }
  /**
   * Get file status
   */
  status(options) {
    return (options?.client ?? this._client).get({
      url: "/file/status",
      ...options
    });
  }
}
class App extends _HeyApiClient {
  /**
   * Write a log entry to the server logs
   */
  log(options) {
    return (options?.client ?? this._client).post({
      url: "/log",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * List all agents
   */
  agents(options) {
    return (options?.client ?? this._client).get({
      url: "/agent",
      ...options
    });
  }
}
class Auth extends _HeyApiClient {
  /**
   * Remove OAuth credentials for an MCP server
   */
  remove(options) {
    return (options.client ?? this._client).delete({
      url: "/mcp/{name}/auth",
      ...options
    });
  }
  /**
   * Start OAuth authentication flow for an MCP server
   */
  start(options) {
    return (options.client ?? this._client).post({
      url: "/mcp/{name}/auth",
      ...options
    });
  }
  /**
   * Complete OAuth authentication with authorization code
   */
  callback(options) {
    return (options.client ?? this._client).post({
      url: "/mcp/{name}/auth/callback",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Start OAuth flow and wait for callback (opens browser)
   */
  authenticate(options) {
    return (options.client ?? this._client).post({
      url: "/mcp/{name}/auth/authenticate",
      ...options
    });
  }
  /**
   * Set authentication credentials
   */
  set(options) {
    return (options.client ?? this._client).put({
      url: "/auth/{id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
}
class Mcp extends _HeyApiClient {
  /**
   * Get MCP server status
   */
  status(options) {
    return (options?.client ?? this._client).get({
      url: "/mcp",
      ...options
    });
  }
  /**
   * Add MCP server dynamically
   */
  add(options) {
    return (options?.client ?? this._client).post({
      url: "/mcp",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Connect an MCP server
   */
  connect(options) {
    return (options.client ?? this._client).post({
      url: "/mcp/{name}/connect",
      ...options
    });
  }
  /**
   * Disconnect an MCP server
   */
  disconnect(options) {
    return (options.client ?? this._client).post({
      url: "/mcp/{name}/disconnect",
      ...options
    });
  }
  auth = new Auth({ client: this._client });
}
class Lsp extends _HeyApiClient {
  /**
   * Get LSP server status
   */
  status(options) {
    return (options?.client ?? this._client).get({
      url: "/lsp",
      ...options
    });
  }
}
class Formatter extends _HeyApiClient {
  /**
   * Get formatter status
   */
  status(options) {
    return (options?.client ?? this._client).get({
      url: "/formatter",
      ...options
    });
  }
}
class Control extends _HeyApiClient {
  /**
   * Get the next TUI request from the queue
   */
  next(options) {
    return (options?.client ?? this._client).get({
      url: "/tui/control/next",
      ...options
    });
  }
  /**
   * Submit a response to the TUI request queue
   */
  response(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/control/response",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
}
class Tui extends _HeyApiClient {
  /**
   * Append prompt to the TUI
   */
  appendPrompt(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/append-prompt",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Open the help dialog
   */
  openHelp(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/open-help",
      ...options
    });
  }
  /**
   * Open the session dialog
   */
  openSessions(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/open-sessions",
      ...options
    });
  }
  /**
   * Open the theme dialog
   */
  openThemes(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/open-themes",
      ...options
    });
  }
  /**
   * Open the model dialog
   */
  openModels(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/open-models",
      ...options
    });
  }
  /**
   * Submit the prompt
   */
  submitPrompt(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/submit-prompt",
      ...options
    });
  }
  /**
   * Clear the prompt
   */
  clearPrompt(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/clear-prompt",
      ...options
    });
  }
  /**
   * Execute a TUI command (e.g. agent_cycle)
   */
  executeCommand(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/execute-command",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Show a toast notification in the TUI
   */
  showToast(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/show-toast",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Publish a TUI event
   */
  publish(options) {
    return (options?.client ?? this._client).post({
      url: "/tui/publish",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  control = new Control({ client: this._client });
}
class Event extends _HeyApiClient {
  /**
   * Get events
   */
  subscribe(options) {
    return (options?.client ?? this._client).get.sse({
      url: "/event",
      ...options
    });
  }
}
class OpencodeClient extends _HeyApiClient {
  /**
   * Respond to a permission request
   */
  postSessionIdPermissionsPermissionId(options) {
    return (options.client ?? this._client).post({
      url: "/session/{id}/permissions/{permissionID}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  global = new Global({ client: this._client });
  project = new Project({ client: this._client });
  pty = new Pty({ client: this._client });
  config = new Config({ client: this._client });
  tool = new Tool({ client: this._client });
  instance = new Instance({ client: this._client });
  path = new Path({ client: this._client });
  vcs = new Vcs({ client: this._client });
  session = new Session({ client: this._client });
  command = new Command({ client: this._client });
  provider = new Provider({ client: this._client });
  find = new Find({ client: this._client });
  file = new File({ client: this._client });
  app = new App({ client: this._client });
  mcp = new Mcp({ client: this._client });
  lsp = new Lsp({ client: this._client });
  formatter = new Formatter({ client: this._client });
  tui = new Tui({ client: this._client });
  auth = new Auth({ client: this._client });
  event = new Event({ client: this._client });
}
function pick(value, fallback) {
  if (!value)
    return;
  if (!fallback)
    return value;
  if (value === fallback)
    return fallback;
  if (value === encodeURIComponent(fallback))
    return fallback;
  return value;
}
function rewrite(request, directory) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return request;
  const value = pick(request.headers.get("x-opencode-directory"), directory);
  if (!value)
    return request;
  const url = new URL(request.url);
  if (!url.searchParams.has("directory")) {
    url.searchParams.set("directory", value);
  }
  const next = new Request(url, request);
  next.headers.delete("x-opencode-directory");
  return next;
}
function createOpencodeClient(config) {
  if (!config?.fetch) {
    const customFetch = (req) => {
      req.timeout = false;
      return fetch(req);
    };
    config = {
      ...config,
      fetch: customFetch
    };
  }
  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-opencode-directory": encodeURIComponent(config.directory)
    };
  }
  const client2 = createClient(config);
  client2.interceptors.request.use((request) => rewrite(request, config?.directory));
  return new OpencodeClient({ client: client2 });
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
var crossSpawn = { exports: {} };
var windows;
var hasRequiredWindows;
function requireWindows() {
  if (hasRequiredWindows) return windows;
  hasRequiredWindows = 1;
  windows = isexe;
  isexe.sync = sync;
  var fs = require$$0;
  function checkPathExt(path, options) {
    var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
    if (!pathext) {
      return true;
    }
    pathext = pathext.split(";");
    if (pathext.indexOf("") !== -1) {
      return true;
    }
    for (var i = 0; i < pathext.length; i++) {
      var p = pathext[i].toLowerCase();
      if (p && path.substr(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }
  function checkStat(stat, path, options) {
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      return false;
    }
    return checkPathExt(path, options);
  }
  function isexe(path, options, cb) {
    fs.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, path, options));
    });
  }
  function sync(path, options) {
    return checkStat(fs.statSync(path), path, options);
  }
  return windows;
}
var mode;
var hasRequiredMode;
function requireMode() {
  if (hasRequiredMode) return mode;
  hasRequiredMode = 1;
  mode = isexe;
  isexe.sync = sync;
  var fs = require$$0;
  function isexe(path, options, cb) {
    fs.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, options));
    });
  }
  function sync(path, options) {
    return checkStat(fs.statSync(path), options);
  }
  function checkStat(stat, options) {
    return stat.isFile() && checkMode(stat, options);
  }
  function checkMode(stat, options) {
    var mod = stat.mode;
    var uid = stat.uid;
    var gid = stat.gid;
    var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
    var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
    var u = parseInt("100", 8);
    var g = parseInt("010", 8);
    var o = parseInt("001", 8);
    var ug = u | g;
    var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
    return ret;
  }
  return mode;
}
var isexe_1;
var hasRequiredIsexe;
function requireIsexe() {
  if (hasRequiredIsexe) return isexe_1;
  hasRequiredIsexe = 1;
  var core;
  if (process.platform === "win32" || commonjsGlobal.TESTING_WINDOWS) {
    core = requireWindows();
  } else {
    core = requireMode();
  }
  isexe_1 = isexe;
  isexe.sync = sync;
  function isexe(path, options, cb) {
    if (typeof options === "function") {
      cb = options;
      options = {};
    }
    if (!cb) {
      if (typeof Promise !== "function") {
        throw new TypeError("callback not provided");
      }
      return new Promise(function(resolve, reject) {
        isexe(path, options || {}, function(er, is) {
          if (er) {
            reject(er);
          } else {
            resolve(is);
          }
        });
      });
    }
    core(path, options || {}, function(er, is) {
      if (er) {
        if (er.code === "EACCES" || options && options.ignoreErrors) {
          er = null;
          is = false;
        }
      }
      cb(er, is);
    });
  }
  function sync(path, options) {
    try {
      return core.sync(path, options || {});
    } catch (er) {
      if (options && options.ignoreErrors || er.code === "EACCES") {
        return false;
      } else {
        throw er;
      }
    }
  }
  return isexe_1;
}
var which_1;
var hasRequiredWhich;
function requireWhich() {
  if (hasRequiredWhich) return which_1;
  hasRequiredWhich = 1;
  const isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
  const path = require$$0$1;
  const COLON = isWindows ? ";" : ":";
  const isexe = requireIsexe();
  const getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
  const getPathInfo = (cmd, opt) => {
    const colon = opt.colon || COLON;
    const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
      // windows always checks the cwd first
      ...isWindows ? [process.cwd()] : [],
      ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
      "").split(colon)
    ];
    const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
    const pathExt = isWindows ? pathExtExe.split(colon) : [""];
    if (isWindows) {
      if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
        pathExt.unshift("");
    }
    return {
      pathEnv,
      pathExt,
      pathExtExe
    };
  };
  const which = (cmd, opt, cb) => {
    if (typeof opt === "function") {
      cb = opt;
      opt = {};
    }
    if (!opt)
      opt = {};
    const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
    const found = [];
    const step = (i) => new Promise((resolve, reject) => {
      if (i === pathEnv.length)
        return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
      const ppRaw = pathEnv[i];
      const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
      const pCmd = path.join(pathPart, cmd);
      const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
      resolve(subStep(p, i, 0));
    });
    const subStep = (p, i, ii) => new Promise((resolve, reject) => {
      if (ii === pathExt.length)
        return resolve(step(i + 1));
      const ext = pathExt[ii];
      isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
        if (!er && is) {
          if (opt.all)
            found.push(p + ext);
          else
            return resolve(p + ext);
        }
        return resolve(subStep(p, i, ii + 1));
      });
    });
    return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
  };
  const whichSync = (cmd, opt) => {
    opt = opt || {};
    const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
    const found = [];
    for (let i = 0; i < pathEnv.length; i++) {
      const ppRaw = pathEnv[i];
      const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
      const pCmd = path.join(pathPart, cmd);
      const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
      for (let j = 0; j < pathExt.length; j++) {
        const cur = p + pathExt[j];
        try {
          const is = isexe.sync(cur, { pathExt: pathExtExe });
          if (is) {
            if (opt.all)
              found.push(cur);
            else
              return cur;
          }
        } catch (ex) {
        }
      }
    }
    if (opt.all && found.length)
      return found;
    if (opt.nothrow)
      return null;
    throw getNotFoundError(cmd);
  };
  which_1 = which;
  which.sync = whichSync;
  return which_1;
}
var pathKey = { exports: {} };
var hasRequiredPathKey;
function requirePathKey() {
  if (hasRequiredPathKey) return pathKey.exports;
  hasRequiredPathKey = 1;
  const pathKey$1 = (options = {}) => {
    const environment = options.env || process.env;
    const platform = options.platform || process.platform;
    if (platform !== "win32") {
      return "PATH";
    }
    return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
  };
  pathKey.exports = pathKey$1;
  pathKey.exports.default = pathKey$1;
  return pathKey.exports;
}
var resolveCommand_1;
var hasRequiredResolveCommand;
function requireResolveCommand() {
  if (hasRequiredResolveCommand) return resolveCommand_1;
  hasRequiredResolveCommand = 1;
  const path = require$$0$1;
  const which = requireWhich();
  const getPathKey = requirePathKey();
  function resolveCommandAttempt(parsed, withoutPathExt) {
    const env = parsed.options.env || process.env;
    const cwd = process.cwd();
    const hasCustomCwd = parsed.options.cwd != null;
    const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
    if (shouldSwitchCwd) {
      try {
        process.chdir(parsed.options.cwd);
      } catch (err) {
      }
    }
    let resolved;
    try {
      resolved = which.sync(parsed.command, {
        path: env[getPathKey({ env })],
        pathExt: withoutPathExt ? path.delimiter : void 0
      });
    } catch (e) {
    } finally {
      if (shouldSwitchCwd) {
        process.chdir(cwd);
      }
    }
    if (resolved) {
      resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
    }
    return resolved;
  }
  function resolveCommand(parsed) {
    return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
  }
  resolveCommand_1 = resolveCommand;
  return resolveCommand_1;
}
var _escape = {};
var hasRequired_escape;
function require_escape() {
  if (hasRequired_escape) return _escape;
  hasRequired_escape = 1;
  const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
  function escapeCommand(arg) {
    arg = arg.replace(metaCharsRegExp, "^$1");
    return arg;
  }
  function escapeArgument(arg, doubleEscapeMetaChars) {
    arg = `${arg}`;
    arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
    arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
    arg = `"${arg}"`;
    arg = arg.replace(metaCharsRegExp, "^$1");
    if (doubleEscapeMetaChars) {
      arg = arg.replace(metaCharsRegExp, "^$1");
    }
    return arg;
  }
  _escape.command = escapeCommand;
  _escape.argument = escapeArgument;
  return _escape;
}
var shebangRegex;
var hasRequiredShebangRegex;
function requireShebangRegex() {
  if (hasRequiredShebangRegex) return shebangRegex;
  hasRequiredShebangRegex = 1;
  shebangRegex = /^#!(.*)/;
  return shebangRegex;
}
var shebangCommand;
var hasRequiredShebangCommand;
function requireShebangCommand() {
  if (hasRequiredShebangCommand) return shebangCommand;
  hasRequiredShebangCommand = 1;
  const shebangRegex2 = requireShebangRegex();
  shebangCommand = (string = "") => {
    const match = string.match(shebangRegex2);
    if (!match) {
      return null;
    }
    const [path, argument] = match[0].replace(/#! ?/, "").split(" ");
    const binary = path.split("/").pop();
    if (binary === "env") {
      return argument;
    }
    return argument ? `${binary} ${argument}` : binary;
  };
  return shebangCommand;
}
var readShebang_1;
var hasRequiredReadShebang;
function requireReadShebang() {
  if (hasRequiredReadShebang) return readShebang_1;
  hasRequiredReadShebang = 1;
  const fs = require$$0;
  const shebangCommand2 = requireShebangCommand();
  function readShebang(command) {
    const size = 150;
    const buffer = Buffer.alloc(size);
    let fd;
    try {
      fd = fs.openSync(command, "r");
      fs.readSync(fd, buffer, 0, size, 0);
      fs.closeSync(fd);
    } catch (e) {
    }
    return shebangCommand2(buffer.toString());
  }
  readShebang_1 = readShebang;
  return readShebang_1;
}
var parse_1;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse_1;
  hasRequiredParse = 1;
  const path = require$$0$1;
  const resolveCommand = requireResolveCommand();
  const escape = require_escape();
  const readShebang = requireReadShebang();
  const isWin = process.platform === "win32";
  const isExecutableRegExp = /\.(?:com|exe)$/i;
  const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function detectShebang(parsed) {
    parsed.file = resolveCommand(parsed);
    const shebang = parsed.file && readShebang(parsed.file);
    if (shebang) {
      parsed.args.unshift(parsed.file);
      parsed.command = shebang;
      return resolveCommand(parsed);
    }
    return parsed.file;
  }
  function parseNonShell(parsed) {
    if (!isWin) {
      return parsed;
    }
    const commandFile = detectShebang(parsed);
    const needsShell = !isExecutableRegExp.test(commandFile);
    if (parsed.options.forceShell || needsShell) {
      const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
      parsed.command = path.normalize(parsed.command);
      parsed.command = escape.command(parsed.command);
      parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
      const shellCommand = [parsed.command].concat(parsed.args).join(" ");
      parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
      parsed.command = process.env.comspec || "cmd.exe";
      parsed.options.windowsVerbatimArguments = true;
    }
    return parsed;
  }
  function parse(command, args, options) {
    if (args && !Array.isArray(args)) {
      options = args;
      args = null;
    }
    args = args ? args.slice(0) : [];
    options = Object.assign({}, options);
    const parsed = {
      command,
      args,
      options,
      file: void 0,
      original: {
        command,
        args
      }
    };
    return options.shell ? parsed : parseNonShell(parsed);
  }
  parse_1 = parse;
  return parse_1;
}
var enoent;
var hasRequiredEnoent;
function requireEnoent() {
  if (hasRequiredEnoent) return enoent;
  hasRequiredEnoent = 1;
  const isWin = process.platform === "win32";
  function notFoundError(original, syscall) {
    return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${syscall} ${original.command}`,
      path: original.command,
      spawnargs: original.args
    });
  }
  function hookChildProcess(cp, parsed) {
    if (!isWin) {
      return;
    }
    const originalEmit = cp.emit;
    cp.emit = function(name, arg1) {
      if (name === "exit") {
        const err = verifyENOENT(arg1, parsed);
        if (err) {
          return originalEmit.call(cp, "error", err);
        }
      }
      return originalEmit.apply(cp, arguments);
    };
  }
  function verifyENOENT(status, parsed) {
    if (isWin && status === 1 && !parsed.file) {
      return notFoundError(parsed.original, "spawn");
    }
    return null;
  }
  function verifyENOENTSync(status, parsed) {
    if (isWin && status === 1 && !parsed.file) {
      return notFoundError(parsed.original, "spawnSync");
    }
    return null;
  }
  enoent = {
    hookChildProcess,
    verifyENOENT,
    verifyENOENTSync,
    notFoundError
  };
  return enoent;
}
var hasRequiredCrossSpawn;
function requireCrossSpawn() {
  if (hasRequiredCrossSpawn) return crossSpawn.exports;
  hasRequiredCrossSpawn = 1;
  const cp = require$$0$2;
  const parse = requireParse();
  const enoent2 = requireEnoent();
  function spawn(command, args, options) {
    const parsed = parse(command, args, options);
    const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
    enoent2.hookChildProcess(spawned, parsed);
    return spawned;
  }
  function spawnSync(command, args, options) {
    const parsed = parse(command, args, options);
    const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
    result.error = result.error || enoent2.verifyENOENTSync(result.status, parsed);
    return result;
  }
  crossSpawn.exports = spawn;
  crossSpawn.exports.spawn = spawn;
  crossSpawn.exports.sync = spawnSync;
  crossSpawn.exports._parse = parse;
  crossSpawn.exports._enoent = enoent2;
  return crossSpawn.exports;
}
requireCrossSpawn();
let child = null;
let client = null;
let baseUrl = null;
let readyPromise = null;
let subscriptionLoopActive = false;
let subscriptionAbort = null;
let stopped = false;
const HEARTBEAT_MS = 15e3;
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 5e3;
function resolveBinaryPath() {
  const binName = process.platform === "win32" ? "opencode.exe" : "opencode";
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "bin", binName);
  }
  const devPath = node_path.resolve(__dirname, "../../resources/bin", binName);
  if (node_fs.existsSync(devPath)) return devPath;
  return binName;
}
async function boot() {
  const binary = resolveBinaryPath();
  const args = ["serve", "--hostname=127.0.0.1", "--port=0"];
  const proc = node_child_process.spawn(binary, args, {
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child = proc;
  const url = await new Promise((resolveUrl, rejectUrl) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    const timer = setTimeout(() => {
      rejectUrl(
        new Error(
          `Timed out waiting for opencode sidecar.
stdout: ${stdoutBuf}
stderr: ${stderrBuf}`
        )
      );
    }, 1e4);
    proc.stdout?.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      for (const line of stdoutBuf.split("\n")) {
        const m = line.match(/opencode server listening\s+on\s+(https?:\/\/\S+)/);
        if (m) {
          clearTimeout(timer);
          resolveUrl(m[1]);
          return;
        }
      }
    });
    proc.stderr?.on("data", (chunk) => {
      stderrBuf += chunk.toString();
    });
    proc.on("exit", (code, signal) => {
      clearTimeout(timer);
      rejectUrl(
        new Error(
          `opencode sidecar exited early (code=${code} signal=${signal})
stdout: ${stdoutBuf}
stderr: ${stderrBuf}`
        )
      );
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      rejectUrl(err);
    });
  });
  baseUrl = url;
  const c = createOpencodeClient({ baseUrl: url });
  client = c;
  console.log(`[opencode] sidecar ready at ${url}`);
  startEventBus(c);
  return c;
}
function dirOptions(dir) {
  if (!dir) return {};
  return {
    headers: {
      "x-opencode-directory": encodeURIComponent(dir)
    },
    query: { directory: dir }
  };
}
function broadcast(channel, payload) {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
async function runSubscription(c, signal) {
  const sub = await c.global.event({ signal });
  let heartbeat = null;
  const resetHeartbeat = () => {
    if (heartbeat) clearTimeout(heartbeat);
    heartbeat = setTimeout(() => {
      subscriptionAbort?.abort();
    }, HEARTBEAT_MS);
  };
  resetHeartbeat();
  try {
    for await (const raw of sub.stream) {
      if (signal.aborted) break;
      resetHeartbeat();
      const evt = raw?.payload ?? raw;
      console.log("[opencode] event:", evt?.type);
      broadcast("opencode:event", evt);
    }
  } finally {
    if (heartbeat) clearTimeout(heartbeat);
  }
}
async function startEventBus(c) {
  if (subscriptionLoopActive) return;
  subscriptionLoopActive = true;
  let attempt = 0;
  while (!stopped) {
    subscriptionAbort = new AbortController();
    try {
      broadcast("opencode:status", { connected: true });
      await runSubscription(c, subscriptionAbort.signal);
      attempt = 0;
    } catch (err) {
      if (stopped) break;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[opencode] event bus error:", msg);
    } finally {
      broadcast("opencode:status", { connected: false });
    }
    if (stopped) break;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_MIN_MS * Math.pow(2, attempt)
    );
    attempt = Math.min(attempt + 1, 6);
    await new Promise((r) => setTimeout(r, delay));
  }
  subscriptionLoopActive = false;
}
function reconnectEventBus() {
  subscriptionAbort?.abort();
}
function startOpencodeSidecar() {
  if (!readyPromise) {
    stopped = false;
    readyPromise = boot();
  }
  return readyPromise;
}
function getClient() {
  if (!client) {
    throw new Error("opencode sidecar not ready — call startOpencodeSidecar first");
  }
  return client;
}
function getBaseUrl() {
  return baseUrl;
}
function stopOpencodeSidecar() {
  stopped = true;
  subscriptionAbort?.abort();
  if (child && !child.killed) {
    try {
      child.kill();
    } catch {
    }
  }
  child = null;
  client = null;
  baseUrl = null;
  readyPromise = null;
  subscriptionLoopActive = false;
}
function prefsPath() {
  return node_path.join(electron.app.getPath("userData"), "session-prefs.json");
}
function load() {
  const p = prefsPath();
  if (!node_fs.existsSync(p)) return {};
  try {
    return JSON.parse(node_fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}
function save(data) {
  const p = prefsPath();
  node_fs.mkdirSync(node_path.dirname(p), { recursive: true });
  node_fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}
function getPrefs(sessionId) {
  return load()[sessionId] ?? {};
}
function setPrefs(sessionId, patch) {
  const all = load();
  all[sessionId] = { ...all[sessionId], ...patch };
  save(all);
  return all[sessionId];
}
function deletePrefs(sessionId) {
  const all = load();
  delete all[sessionId];
  save(all);
}
function allPrefs() {
  return load();
}
function mergeSession(s) {
  const prefs = getPrefs(s.id);
  return {
    id: s.id,
    title: s.title,
    projectDir: s.directory ?? null,
    providerId: prefs.providerId ?? null,
    modelId: prefs.modelId ?? null,
    previewUrl: prefs.previewUrl ?? null,
    createdAt: s.time ? new Date(s.time.created).toISOString() : "",
    updatedAt: s.time ? new Date(s.time.updated).toISOString() : ""
  };
}
function registerSessionHandlers() {
  electron.ipcMain.handle("sessions:list", async () => {
    const client2 = getClient();
    const base = getBaseUrl();
    const projRes = await client2.project.list();
    const projects = projRes.data ?? [];
    const fetchProjectSessions = async (worktree) => {
      if (!base) return [];
      const r = await fetch(`${base}/session`, {
        headers: {
          "x-opencode-directory": encodeURIComponent(worktree)
        }
      });
      if (!r.ok) {
        console.warn(
          `[sessions:list] ${worktree} → ${r.status} ${r.statusText}`
        );
        return [];
      }
      return await r.json();
    };
    const lists = await Promise.all(
      projects.map(async (p) => {
        try {
          const rows = await fetchProjectSessions(p.worktree);
          return rows.map(mergeSession);
        } catch (err) {
          console.warn(
            `[sessions:list] failed for ${p.worktree}:`,
            err instanceof Error ? err.message : err
          );
          return [];
        }
      })
    );
    const byId = /* @__PURE__ */ new Map();
    for (const s of lists.flat()) byId.set(s.id, s);
    return [...byId.values()].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    );
  });
  electron.ipcMain.handle("sessions:get", async (_e, id) => {
    const client2 = getClient();
    const res = await client2.session.get({ path: { id } });
    if (!res.data) return null;
    return mergeSession(res.data);
  });
  electron.ipcMain.handle(
    "sessions:create",
    async (_e, data) => {
      const client2 = getClient();
      const res = await client2.session.create({
        body: { title: data.title ?? "New Session" },
        ...dirOptions(data.projectDir)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      });
      const r = res;
      if (r?.error || r?.response && !r.response.ok) {
        const msg = r.error?.data?.message ?? r.error?.message ?? `Failed to create session (${r.response?.status ?? "?"})`;
        throw new Error(String(msg));
      }
      const s = r.data;
      if (!s?.id) throw new Error("Session create returned no id");
      if (data.providerId || data.modelId || data.previewUrl) {
        setPrefs(s.id, {
          providerId: data.providerId,
          modelId: data.modelId,
          previewUrl: data.previewUrl
        });
      }
      return mergeSession(s);
    }
  );
  electron.ipcMain.handle(
    "sessions:update",
    async (_e, id, data) => {
      const client2 = getClient();
      if (data.title !== void 0) {
        let dir = data.projectDir;
        if (!dir) {
          try {
            const cur = await client2.session.get({ path: { id } });
            dir = cur.data?.directory;
          } catch {
          }
        }
        await client2.session.update({
          path: { id },
          body: { title: data.title },
          ...dirOptions(dir)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        });
      }
      if (data.providerId !== void 0 || data.modelId !== void 0 || data.previewUrl !== void 0) {
        setPrefs(id, {
          providerId: data.providerId,
          modelId: data.modelId,
          previewUrl: data.previewUrl
        });
      }
      const res = await client2.session.get({ path: { id } });
      return res.data ? mergeSession(res.data) : null;
    }
  );
  electron.ipcMain.handle("sessions:delete", async (_e, id) => {
    const client2 = getClient();
    await client2.session.delete({ path: { id } });
    deletePrefs(id);
    return { ok: true };
  });
  electron.ipcMain.handle("sessions:getMessages", async (_e, sessionId) => {
    const client2 = getClient();
    const res = await client2.session.messages({ path: { id: sessionId } });
    return res.data ?? [];
  });
  electron.ipcMain.handle("sessions:allPrefs", () => allPrefs());
}
function buildParts(prompt, images) {
  const parts = [];
  if (images) {
    for (const dataUrl of images) {
      const m = dataUrl.match(/^data:([^;]+);/);
      parts.push({ type: "file", mime: m?.[1] ?? "image/png", url: dataUrl });
    }
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}
function registerChatHandlers() {
  electron.ipcMain.handle(
    "chat:prompt",
    async (_e, params) => {
      const { sessionId, prompt, providerId, modelId, projectDir, images } = params;
      setPrefs(sessionId, { providerId, modelId });
      try {
        const client2 = getClient();
        console.log(
          "[chat:prompt] sending",
          { sessionId, providerId, modelId, projectDir }
        );
        const result = await client2.session.prompt({
          path: { id: sessionId },
          body: {
            model: { providerID: providerId, modelID: modelId },
            parts: buildParts(prompt, images)
          },
          ...dirOptions(projectDir)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        });
        const r = result;
        if (r?.error) {
          const msg = r.error?.data?.message ?? r.error?.message ?? (typeof r.error === "string" ? r.error : "Prompt failed");
          console.error("[chat:prompt] error:", r.error);
          return { ok: false, error: String(msg) };
        }
        if (r?.response && !r.response.ok) {
          const msg = `Prompt failed: ${r.response.status} ${r.response.statusText}`;
          console.error("[chat:prompt]", msg, r);
          return { ok: false, error: msg };
        }
        console.log(
          "[chat:prompt] ok, status:",
          r?.response?.status,
          "data keys:",
          r?.data ? Object.keys(r.data) : "none"
        );
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[chat:prompt] threw:", err);
        return { ok: false, error: message };
      }
    }
  );
  electron.ipcMain.handle(
    "chat:stop",
    async (_e, sessionId, projectDir) => {
      try {
        await getClient().session.abort({
          path: { id: sessionId },
          ...dirOptions(projectDir)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        });
      } catch {
      }
      return { ok: true };
    }
  );
  electron.ipcMain.handle("opencode:reconnect", () => {
    reconnectEventBus();
    return { ok: true };
  });
}
const HIDDEN = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  ".Trash",
  "__pycache__",
  ".tox",
  ".venv",
  "dist",
  ".turbo",
  ".DS_Store"
]);
const EXT_LANG = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".toml": "toml",
  ".ini": "ini",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".svg": "xml",
  ".dockerfile": "dockerfile",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".dart": "dart",
  ".lua": "lua",
  ".r": "r",
  ".vue": "html",
  ".svelte": "html"
};
const BINARY_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".avif",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".mkv",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sqlite",
  ".db"
]);
function isBinary(name) {
  return BINARY_EXTS.has(node_path.extname(name).toLowerCase());
}
function detectLanguage(name) {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".gitignore" || lower === ".dockerignore") return "plaintext";
  return EXT_LANG[node_path.extname(lower)] || "plaintext";
}
function registerFsHandlers() {
  electron.ipcMain.handle("fs:listDirs", async (_e, path) => {
    const current = node_path.resolve(path || node_os.homedir());
    const parent = node_path.dirname(current) !== current ? node_path.dirname(current) : null;
    try {
      const entries = await promises.readdir(current, { withFileTypes: true });
      const dirs = entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith(".") && !HIDDEN.has(e.name)
      ).map((e) => e.name).sort(
        (a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })
      );
      return { current, parent, dirs };
    } catch {
      throw new Error(`Cannot read directory: ${current}`);
    }
  });
  electron.ipcMain.handle("fs:listTree", async (_e, path) => {
    const dirPath = node_path.resolve(path);
    try {
      const entries = await promises.readdir(dirPath, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".env") continue;
        if (HIDDEN.has(entry.name)) continue;
        if (entry.isDirectory()) {
          result.push({ name: entry.name, type: "dir" });
        } else if (entry.isFile()) {
          result.push({ name: entry.name, type: "file" });
        }
      }
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, void 0, {
          sensitivity: "base"
        });
      });
      return { entries: result };
    } catch {
      throw new Error(`Cannot read directory: ${dirPath}`);
    }
  });
  electron.ipcMain.handle("fs:readFile", async (_e, path) => {
    const filePath = node_path.resolve(path);
    try {
      const s = await promises.stat(filePath);
      if (!s.isFile()) throw new Error("Not a file");
      if (isBinary(filePath)) {
        return { binary: true, size: s.size };
      }
      if (s.size > 2 * 1024 * 1024) {
        throw new Error(`File too large (> 2MB), size: ${s.size}`);
      }
      const content = await promises.readFile(filePath, "utf-8");
      const language = detectLanguage(filePath);
      return { content, language };
    } catch (err) {
      throw new Error(
        `Cannot read file: ${filePath} - ${err instanceof Error ? err.message : err}`
      );
    }
  });
  electron.ipcMain.handle(
    "fs:writeFile",
    async (_e, path, content) => {
      const filePath = node_path.resolve(path);
      try {
        await promises.mkdir(node_path.dirname(filePath), { recursive: true });
        await promises.writeFile(filePath, content, "utf-8");
        return { ok: true };
      } catch {
        throw new Error(`Cannot write file: ${filePath}`);
      }
    }
  );
  electron.ipcMain.handle(
    "fs:createEntry",
    async (_e, path, type) => {
      const targetPath = node_path.resolve(path);
      try {
        if (type === "dir") {
          await promises.mkdir(targetPath, { recursive: true });
        } else {
          await promises.mkdir(node_path.dirname(targetPath), { recursive: true });
          await promises.writeFile(targetPath, "", "utf-8");
        }
        return { ok: true };
      } catch {
        throw new Error(`Cannot create: ${targetPath}`);
      }
    }
  );
  electron.ipcMain.handle("fs:deleteEntry", async (_e, path) => {
    const targetPath = node_path.resolve(path);
    try {
      const s = await promises.stat(targetPath);
      await promises.rm(targetPath, { recursive: s.isDirectory(), force: true });
      return { ok: true };
    } catch {
      throw new Error(`Cannot delete: ${targetPath}`);
    }
  });
  electron.ipcMain.handle(
    "fs:upload",
    async (_e, dirPath, fileName, data) => {
      const targetDir = node_path.resolve(dirPath);
      await promises.mkdir(targetDir, { recursive: true });
      const targetPath = node_path.join(targetDir, fileName);
      await promises.writeFile(targetPath, Buffer.from(data));
      return { ok: true, name: fileName };
    }
  );
}
function isGitRepo(dir) {
  try {
    node_child_process.execSync("git rev-parse --git-dir", {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8"
    });
    return true;
  } catch {
    return false;
  }
}
function runGit(cmd, dir, opts) {
  try {
    return node_child_process.execSync(cmd, {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8"
    }).trim();
  } catch (error) {
    if (opts?.throwOnError) throw error;
    return `Error: ${error.message}`;
  }
}
function registerGitHandlers() {
  electron.ipcMain.handle("git:status", async (_e, dir) => {
    const d = node_path.resolve(dir);
    if (!isGitRepo(d)) {
      return { error: "Not a git repository", isGitRepo: false };
    }
    const branch = runGit("git rev-parse --abbrev-ref HEAD", d);
    let status = "";
    try {
      status = node_child_process.execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trimEnd();
    } catch {
    }
    let ahead = "0";
    let behind = "0";
    try {
      ahead = node_child_process.execSync("git rev-list --count @{u}..HEAD", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trim();
    } catch {
      try {
        ahead = node_child_process.execSync(`git rev-list --count origin/${branch}..HEAD`, {
          cwd: d,
          stdio: "pipe",
          encoding: "utf-8"
        }).trim();
      } catch {
      }
    }
    try {
      behind = node_child_process.execSync("git rev-list --count HEAD..@{u}", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trim();
    } catch {
      try {
        behind = node_child_process.execSync(`git rev-list --count HEAD..origin/${branch}`, {
          cwd: d,
          stdio: "pipe",
          encoding: "utf-8"
        }).trim();
      } catch {
      }
    }
    const changes = status.split("\n").filter((line) => line.trim()).map((line) => ({
      file: line.substring(3),
      index: line[0] === " " ? "" : line[0],
      workTree: line[1] === " " ? "" : line[1],
      status: line.substring(0, 2).trim()
    }));
    const merging = runGit("git status --short", d).includes("UU");
    return {
      isGitRepo: true,
      branch,
      changes,
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      isMerging: merging,
      directory: d
    };
  });
  electron.ipcMain.handle("git:branches", async (_e, dir) => {
    const d = node_path.resolve(dir);
    if (!isGitRepo(d)) {
      throw new Error("Not a git repository");
    }
    const currentBranch = runGit("git rev-parse --abbrev-ref HEAD", d);
    const branchList = runGit("git branch -a", d);
    const branches = branchList.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const isRemote = trimmed.startsWith("remotes/");
      const isCurrent = trimmed.startsWith("*");
      const name = trimmed.replace(/^\*\s+/, "").replace(/^remotes\//, "");
      return {
        name,
        isCurrent: isCurrent || name === currentBranch,
        isRemote,
        fullRef: trimmed.replace("* ", "")
      };
    }).filter(Boolean);
    return { branches, currentBranch };
  });
  electron.ipcMain.handle("git:checkout", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    runGit(`git checkout ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });
  electron.ipcMain.handle("git:createBranch", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    runGit(`git branch ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });
  electron.ipcMain.handle(
    "git:deleteBranch",
    async (_e, dir, branch, force) => {
      const d = node_path.resolve(dir);
      const flag = force ? "-D" : "-d";
      runGit(`git branch ${flag} ${branch}`, d, { throwOnError: true });
      return { ok: true, branch };
    }
  );
  electron.ipcMain.handle("git:merge", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    try {
      runGit(`git merge ${branch}`, d, { throwOnError: true });
      const newStatus = runGit("git status --short", d);
      const hasConflicts = newStatus.includes("UU") || newStatus.includes("AA");
      return { ok: true, merged: !hasConflicts, hasConflicts };
    } catch (error) {
      const err = error;
      const hasConflicts = err.message.includes("CONFLICT");
      return { error: err.message, hasConflicts, ok: false };
    }
  });
  electron.ipcMain.handle("git:conflicts", async (_e, dir) => {
    const d = node_path.resolve(dir);
    const diff = runGit(
      "git diff --name-only --diff-filter=U",
      d
    );
    const conflicts = diff.split("\n").filter((line) => line.trim()).map((file) => ({ file, type: "conflict" }));
    return { conflicts };
  });
  electron.ipcMain.handle("git:diff", async (_e, dir, file) => {
    const d = node_path.resolve(dir);
    const diff = file ? runGit(`git diff ${file}`, d) : runGit("git diff", d);
    return { diff };
  });
  electron.ipcMain.handle(
    "git:stage",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git add -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    }
  );
  electron.ipcMain.handle(
    "git:unstage",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git reset HEAD -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    }
  );
  electron.ipcMain.handle(
    "git:commit",
    async (_e, dir, message) => {
      const d = node_path.resolve(dir);
      const result = node_child_process.spawnSync("git", ["commit", "-F", "-"], {
        cwd: d,
        input: message.trim(),
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8"
      });
      if (result.status !== 0) {
        throw new Error(
          result.stderr || result.stdout || "Commit failed"
        );
      }
      return { ok: true };
    }
  );
  electron.ipcMain.handle("git:push", async (_e, dir) => {
    const d = node_path.resolve(dir);
    try {
      runGit("git push", d, { throwOnError: true });
      return { ok: true };
    } catch {
      runGit("git push -u origin HEAD", d, { throwOnError: true });
      return { ok: true };
    }
  });
  electron.ipcMain.handle("git:pull", async (_e, dir) => {
    const d = node_path.resolve(dir);
    runGit("git pull", d, { throwOnError: true });
    return { ok: true };
  });
  electron.ipcMain.handle(
    "git:discard",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const statusRaw = node_child_process.execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trimEnd();
      const untrackedFiles = new Set(
        statusRaw.split("\n").filter((l) => l.startsWith("??")).map((l) => l.substring(3))
      );
      const trackedFiles = files.filter((f) => !untrackedFiles.has(f));
      const newFiles = files.filter((f) => untrackedFiles.has(f));
      if (trackedFiles.length > 0) {
        const args = trackedFiles.map((f) => `"${f}"`).join(" ");
        runGit(`git checkout -- ${args}`, d, { throwOnError: true });
      }
      if (newFiles.length > 0) {
        for (const f of newFiles) {
          node_child_process.execSync(`rm -f "${f}"`, { cwd: d, stdio: "pipe" });
        }
      }
      return { ok: true };
    }
  );
}
const sessions = /* @__PURE__ */ new Map();
let idCounter = 0;
function generateId() {
  return `pty_${Date.now()}_${++idCounter}`;
}
function detectShell() {
  return process.env.SHELL || "/bin/sh";
}
async function spawnPty(command, args, cwd, env) {
  try {
    const nodePty = await import("@lydell/node-pty");
    const raw = nodePty.spawn(command, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env
    });
    return {
      pid: raw.pid,
      onData: (cb) => {
        raw.onData(cb);
      },
      onExit: (cb) => {
        raw.onExit(cb);
      },
      resize: (cols, rows) => {
        raw.resize(cols, rows);
      },
      write: (data) => {
        raw.write(data);
      },
      kill: () => {
        raw.kill();
      }
    };
  } catch {
    throw new Error(
      "No PTY backend available. Install @lydell/node-pty."
    );
  }
}
function registerPtyHandlers(getWindow2) {
  electron.ipcMain.handle(
    "pty:create",
    async (_e, opts) => {
      const id = generateId();
      const command = opts?.command || detectShell();
      const args = [];
      if (command.endsWith("sh")) {
        args.push("-l");
      }
      const cwd = opts?.cwd || process.cwd();
      const env = {
        ...process.env,
        TERM: "xterm-256color"
      };
      const ptyProcess = await spawnPty(command, args, cwd, env);
      const session = {
        id,
        title: opts?.title || `Terminal ${id.slice(-4)}`,
        command,
        cwd,
        status: "running",
        pid: ptyProcess.pid,
        process: ptyProcess
      };
      sessions.set(id, session);
      ptyProcess.onData((data) => {
        const win = getWindow2();
        win?.webContents.send("pty:data", { id, data });
      });
      ptyProcess.onExit(({ exitCode }) => {
        const win = getWindow2();
        win?.webContents.send("pty:exit", { id, exitCode });
        session.status = "exited";
        sessions.delete(id);
      });
      return {
        id,
        title: session.title,
        command: session.command,
        cwd: session.cwd,
        status: session.status,
        pid: session.pid
      };
    }
  );
  electron.ipcMain.handle("pty:write", (_e, id, data) => {
    const session = sessions.get(id);
    if (session && session.status === "running") {
      session.process.write(data);
    }
  });
  electron.ipcMain.handle(
    "pty:resize",
    (_e, id, cols, rows) => {
      const session = sessions.get(id);
      if (session && session.status === "running") {
        session.process.resize(cols, rows);
      }
      return { ok: true };
    }
  );
  electron.ipcMain.handle("pty:kill", (_e, id) => {
    const session = sessions.get(id);
    if (session) {
      try {
        session.process.kill();
      } catch {
      }
      sessions.delete(id);
    }
    return { ok: true };
  });
  electron.ipcMain.handle("pty:list", () => {
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status
    }));
  });
}
function authFilePath() {
  return node_path.join(node_os.homedir(), ".local", "share", "opencode", "auth.json");
}
function readAuthFile() {
  const p = authFilePath();
  if (!node_fs.existsSync(p)) return {};
  try {
    return JSON.parse(node_fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}
async function fetchProviders() {
  const client2 = getClient();
  const res = await client2.config.providers();
  const data = res.data;
  return data?.providers ?? [];
}
function registerProviderHandlers() {
  electron.ipcMain.handle("providers:connectedModels", async () => {
    const providers = await fetchProviders();
    return providers.map((p) => ({
      providerId: p.id,
      label: p.name,
      models: Object.keys(p.models)
    }));
  });
  electron.ipcMain.handle("providers:hasKey", async (_e, id) => {
    const auth = readAuthFile();
    return !!auth[id];
  });
  electron.ipcMain.handle(
    "providers:setApiKey",
    async (_e, id, apiKey) => {
      try {
        await getClient().auth.set({
          path: { id },
          body: { type: "api", key: apiKey }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        });
        await disposeOpencodeCache();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }
  );
  electron.ipcMain.handle("providers:deleteApiKey", async (_e, id) => {
    const base = getBaseUrl();
    if (!base) return { ok: false, error: "sidecar not ready" };
    try {
      const res = await fetch(
        `${base}/auth/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `Delete failed: ${res.status} ${res.statusText}`
        };
      }
      await disposeOpencodeCache();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });
}
async function disposeOpencodeCache() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/global/dispose`, { method: "POST" });
  } catch (err) {
    console.warn("[providers] failed to dispose opencode cache:", err);
  }
}
function configPath() {
  return node_path.join(electron.app.getPath("userData"), "app-config.json");
}
function loadConfig() {
  const p = configPath();
  if (!node_fs.existsSync(p)) return {};
  try {
    return JSON.parse(node_fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}
function saveConfig(data) {
  const p = configPath();
  node_fs.mkdirSync(node_path.dirname(p), { recursive: true });
  node_fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}
function registerConfigHandlers() {
  electron.ipcMain.handle("config:getCwd", () => {
    return { cwd: process.cwd() };
  });
  electron.ipcMain.handle("config:getActiveProvider", () => {
    return loadConfig()["active-provider"] ?? null;
  });
  electron.ipcMain.handle("config:setActiveProvider", (_e, value) => {
    const all = loadConfig();
    all["active-provider"] = value;
    saveConfig(all);
    return { ok: true };
  });
}
function loadEnvFile(dirPath) {
  const envPath = node_path.resolve(dirPath, ".env");
  const env = { ...process.env };
  if (node_fs.existsSync(envPath)) {
    try {
      const content = node_fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          env[key.trim()] = value;
        }
      }
    } catch {
    }
  }
  return env;
}
function registerActionHandlers() {
  electron.ipcMain.handle("actions:getConfig", async (_e, dir) => {
    const resolvedDir = node_path.resolve(dir);
    const configPath2 = node_path.resolve(resolvedDir, "coodeen.json");
    try {
      const content = await node_fs.promises.readFile(configPath2, "utf-8");
      const config = JSON.parse(content);
      return {
        ok: true,
        actions: config.actions || [],
        name: config.name
      };
    } catch {
      return { ok: true, actions: [], name: "coodeen" };
    }
  });
  electron.ipcMain.handle("actions:run", async (_e, dir, script) => {
    const d = node_path.resolve(dir);
    const env = loadEnvFile(d);
    const child2 = node_child_process.spawn(script, {
      cwd: d,
      env,
      shell: true,
      detached: true,
      stdio: "ignore"
    });
    child2.unref();
    return { ok: true, pid: child2.pid };
  });
}
let mainWindow = null;
function getWindow() {
  return mainWindow;
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: require$$0$1.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(require$$0$1.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  try {
    await startOpencodeSidecar();
  } catch (err) {
    console.error("[main] failed to start opencode sidecar:", err);
  }
  registerSessionHandlers();
  registerChatHandlers();
  registerFsHandlers();
  registerGitHandlers();
  registerPtyHandlers(getWindow);
  registerProviderHandlers();
  registerConfigHandlers();
  registerActionHandlers();
  electron.ipcMain.handle(
    "capture:area",
    async (_e, x, y, width, height) => {
      if (!mainWindow) return null;
      const image = await mainWindow.webContents.capturePage({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      });
      return image.toDataURL();
    }
  );
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  stopOpencodeSidecar();
});
