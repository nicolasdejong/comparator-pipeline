/**
 * Comparator-pipeline.
 * Pipeline is performed left to right.
 * For example array.sort(Comparator.natural.reversed);
 *
 * See readme.md for documentation.
 **/
(function(naturalSort){
'use strict';
var Comparator = createComparatorProxy([]);
module.exports = Comparator;

var actions = {}; // name -> { func, name, type }
var COMPARATOR   = 'comparators';
var VALUEMAPPER  = 'valueMappers';
var RESULTMAPPER = 'resultMappers';
var STEP         = 'steps';
var functionsPerType = {
  comparators:   createTargetProxy(COMPARATOR),
  valueMappers:  createTargetProxy(VALUEMAPPER),
  resultMappers: createTargetProxy(RESULTMAPPER),
  steps:         createTargetProxy(STEP)
};
var defaultSort = function(a, b) { return (a < b ? -1 : (a === b ? 0 : 1)); };

Comparator['default'] = defaultSort;
Comparator.literal    = defaultSort;
Comparator.natural    = naturalSort(/*options*/);
Comparator.configurable.locale = function(locales, o1, o2, o3, o4) {
  return function(a, b) { return String(a).localeCompare(b, locales, o1, o2, o3, o4); }
};

Comparator.valueMappers.any        = function(v) { return v; };
Comparator.valueMappers.text       = function(v) { return String(v); };
Comparator.valueMappers.string     = Comparator.valueMappers.text;
Comparator.valueMappers.strings    = Comparator.valueMappers.string;
Comparator.valueMappers.numbers    = function(v) { return parseFloat(v); }
Comparator.valueMappers.number     = Comparator.valueMappers.numbers;
Comparator.valueMappers.configurable.map = function(mapper) { return function(val, obj) { return mapper.call(this, val, obj); }; }; // TODO: cache mappings
Comparator.valueMappers.ignoreCase = function(v) { return String(v).toLowerCase(); };
Comparator.valueMappers.trim       = function(v) { return String(v).trim(); };

Comparator.steps.configurable.key = function() {
  var names = Array.from(arguments);
  return function(state) {
    if (state.hasResult()) {
      state.isFinished = true;
    } else {
      if (names && names.length) {
        state.a = (state.initialA || {})[names.find(function(name) { return (state.initialA || {})[name] !== undefined; })];
        state.b = (state.initialB || {})[names.find(function(name) { return (state.initialB || {})[name] !== undefined; })];
        state.getResult();
      }
    }
  };
};
Comparator.steps.orElse = function(state) {
  if (state.result === undefined) state.getResult();
  if (state.hasResult()) {
    state.isFinished = true;
  } else {
    state.reset();
  }
};
Comparator.steps.end = function(state) { state.isFinished = true; };

Comparator.resultMappers.reversed = function(result) { this.reversed = !this.reversed; return -result; };
Comparator.resultMappers.reverse  = Comparator.resultMappers.reversed;
Comparator.resultMappers.ascending = function(result) { if (this.reversed) { this.reversed = false; return -result; } return result; };
Comparator.resultMappers.ascend    = Comparator.resultMappers.ascending;
Comparator.resultMappers.descending = function(result) { if (!this.reversed) { this.reversed = true; return -result; } return result; };
Comparator.resultMappers.descend    = Comparator.resultMappers.descending;

function pipelineRunner(pipeline, a, b) {
  var state = {
    a: a,
    b: b,
    initialA: a,
    initialB: b,
    result: undefined,
    isFinished: false,

    pipeline: pipeline,
    step: undefined,
    comparator: undefined,

    getResult: function() { return (state.result = state.comparator.call(state, state.a, state.b)); },
    hasResult: function() { return state.result !== undefined && state.result !== 0; },
    checkResult: function() { return (state.hasResult() ? state.result : state.getResult()); },
    reset: function() {
      state.a = state.initialA;
      state.b = state.initialB;
      state.result = undefined;
      state.isFinished = false;
      state.comparator = actions['default'].func;
    }
  };
  state.reset();
  pipeline.state = state;

  pipeline.forEach(function(step) {
    if (typeof step === 'function') {
      step = step.call(state, state);
    }
    if (state.isFinished) return;
    state.step = step;

    switch (step.type) {
      case STEP:         step.func.call(state, state);
                         break;
      case COMPARATOR:   state.comparator = step.func;
                         state.getResult();
                         break;
      case VALUEMAPPER:  state.a = step.func.call(state, state.a, state.initialA);
                         state.b = step.func.call(state, state.b, state.initialB);
                         state.getResult();
                         break;
      case RESULTMAPPER: state.checkResult();
                         if (state.hasResult()) {
                           state.result = step.func.call(state, state.result);
                         }
                         break;
      default:
    }
  });
  if (state.result === undefined) state.getResult();
  return state.result;
}
function createTargetProxy(type, proxyOptions) {
  if (!proxyOptions) proxyOptions = {};
  return new Proxy({}, {
    get: function(obj, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'type') return type;
      if (prop === 'configurable') return createTargetProxy(type, { configurable: true });
      return (actions[prop] || {}).func;
    },
    set: function(obj, prop, func) {
      if (prop === 'configurable') throw new Error('Attempting to set a read-only property: ' + prop);
      if (typeof func !== 'function') throw new Error('Attempted to set Comparator function to non-function: ' + func);
      var options = Object.assign({}, proxyOptions);

      if (String(func).includes('return function')) {
        options.configurable = true;
      }
      actions[prop] = Object.assign(options, {
        func: func,
        name: prop,
        type: type,
      });
      return true;
    },
    deleteProperty: function(obj, prop) {
      delete actions[prop];
      return true;
    },
  });
}
function createComparatorProxy(previousPipeline, step) {
  if (!previousPipeline) previousPipeline = [];
  var pipeline = step ? previousPipeline.concat(step) : [].concat(previousPipeline);
  var proxiedFunction = function(a, b) { return pipelineRunner(pipeline, a, b); };
  proxiedFunction.pipeline = pipeline;

  var getProp = function(prop) {
    var funcs = functionsPerType[prop];
    if (funcs) return funcs;

    switch(prop) {
      case Symbol.toStringTag: return step ? String(step.func) : undefined;
      case Symbol.toPrimitive: return function() { return 'Comparator: ' + pipelineToString(pipeline); };
      case Symbol['util.inspect.custom']: return 'Comparator function';
      case 'valueOf': return proxiedFunction;
      case 'name': return 'ComparatorProxy';
      case 'setup': return function() { return createComparatorProxy(pipeline.concat(createPipelineFromArgs(Array.from(arguments)))); };
      default:
    }
    if (proxiedFunction[prop]) return proxiedFunction[prop];

    var newStep = actions[prop];
    if (!newStep && prop === 'configurable') return functionsPerType[COMPARATOR][prop];
    if (!newStep) return undefined; // this happens quite frequently by feature-tests
    if (newStep.configurable) {
      var createStep = function() {
        var args = flatten(Array.from(arguments));
        return {
          name: newStep.name,
          type: newStep.type,
          func: newStep.func.apply(null, args)
        };
      };
      var cfgFunc = function() {
        var args = flatten(Array.from(arguments));
        return createComparatorProxy(pipeline, createStep(args));
      };
      return new Proxy(cfgFunc, {
        get: function(obj, prop) { return createComparatorProxy(pipeline, createStep())[prop]; },
        set: function(obj, prop, value) { return setProp(prop, value); },
        deleteProperty: function(obj, prop) { return delProp(prop); }
      });
    }
    return createComparatorProxy(pipeline, newStep);
  };
  var setProp = function(prop, value) {
    if (prop in functionsPerType) throw new Error('Field is readonly: ' + prop);
    functionsPerType.comparators[prop] = value;
    return true;
  };
  var delProp = function(prop) {
    delete actions[prop];
    return true;
  };

  return new Proxy( proxiedFunction, {
    get: function(obj, prop) { return getProp(prop); },
    set: function(obj, prop, value) { return setProp(prop, value); },
    deleteProperty: function(obj, prop) { return delProp(prop); }
  });
}

function createPipelineFromArgs() {
  var items = Array.from(arguments);
  var pipeline = [];
  items = flatten(items);
  while (items.length) {
    var prop = items.shift();
    var action = actions[prop];
    if (!action) throw new Error('Unknown step requested: ' + prop);
    if (action.configurable) {
      var arg = items.shift(); // currently all configurables have exactly 1 argument in setup.
      action = {
        type: action.type,
        name: action.name,
        func: action.func.call(undefined, arg),
        args: arg
      };
    }
    pipeline.push(action);
  }
  return pipeline;
}
function pipelineToString(pipeline) {
  return pipeline.map(function(s) { return s.name + (s.args ? '(' + s.args + ')' : ''); }).join('.') || '[empty]';
}
function flatten(array, flattening) {
  if (!(flattening instanceof Set)) flattening = new Set();
  if (flattening.has(array)) return []; // prevent endless recursion
  flattening.add(array);
  var flat = [];
  array.forEach( function(item) {
    if (Array.isArray(item)) {
      flatten(item, flattening).forEach( function(fitem) { flat.push(fitem); } );
    } else {
      flat.push(item);
    }
  });
  return flat;
}
})(require('natural-sort'));
