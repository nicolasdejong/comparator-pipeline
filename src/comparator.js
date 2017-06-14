/**
 * Comparator-pipeline.
 * Pipeline is performed left to right.
 * For example array.sort(Comparator.natural.reversed);
 *
 * See readme.md for documentation.
 **/
(function(naturalSort){
'use strict';
const Comparator = createComparatorProxy([]);
module.exports = Comparator;

const actions = {}; // name -> { func, name, type }
const COMPARATOR   = 'comparators';
const VALUEMAPPER  = 'valueMappers';
const RESULTMAPPER = 'resultMappers';
const STEP         = 'steps';
const functionsPerType = {
  [COMPARATOR]:   createTargetProxy(COMPARATOR),
  [VALUEMAPPER]:  createTargetProxy(VALUEMAPPER),
  [RESULTMAPPER]: createTargetProxy(RESULTMAPPER),
  [STEP]:         createTargetProxy(STEP)
};
const defaultSort = (a, b) => (a < b ? -1 : (a === b ? 0 : 1));

Comparator['default'] = defaultSort;
Comparator.literal    = defaultSort;
Comparator.natural    = naturalSort;
Comparator.configurable.locale = (locales, ...options) => (a, b) => String(a).localeCompare(b, locales, ...options);

Comparator.valueMappers.any        = v => v;
Comparator.valueMappers.text       = v => String(v);
Comparator.valueMappers.string     = Comparator.valueMappers.text;
Comparator.valueMappers.strings    = Comparator.valueMappers.string;
Comparator.valueMappers.numbers    = v => parseFloat(v);
Comparator.valueMappers.number     = Comparator.valueMappers.numbers;
Comparator.valueMappers.configurable.map = mapper => function(val, obj) { return mapper.call(this, val, obj); }; // TODO: cache mappings
Comparator.valueMappers.ignoreCase = v => String(v).toLowerCase();
Comparator.valueMappers.trim       = v => String(v).trim();

Comparator.steps.configurable.key = (...names) => state => {
  if (state.hasResult()) {
    state.isFinished = true;
  } else {
    if (names && names.length) {
      state.a = (state.initialA || {})[names.find(name => (state.initialA || {})[name] !== undefined)];
      state.b = (state.initialB || {})[names.find(name => (state.initialB || {})[name] !== undefined)];
      state.getResult();
    }
  }
};
Comparator.steps.orElse = state => {
  if (state.result === undefined) state.getResult();
  if (state.hasResult()) {
    state.isFinished = true;
  } else {
    state.reset();
  }
};
Comparator.steps.end = state => state.isFinished = true;

Comparator.resultMappers.reversed = function(result) { this.reversed = !this.reversed; return -result; };
Comparator.resultMappers.reverse  = Comparator.resultMappers.reversed;
Comparator.resultMappers.ascending = function(result) { if (this.reversed) { this.reversed = false; return -result; } return result; };
Comparator.resultMappers.ascend    = Comparator.resultMappers.ascending;
Comparator.resultMappers.descending = function(result) { if (!this.reversed) { this.reversed = true; return -result; } return result; };
Comparator.resultMappers.descend    = Comparator.resultMappers.descending;

function pipelineRunner(pipeline, a, b) {
  const state = {
    a: a,
    b: b,
    initialA: a,
    initialB: b,
    result: undefined,
    isFinished: false,

    pipeline: pipeline,
    step: undefined,
    comparator: undefined,

    getResult: () => state.result = state.comparator.call(state, state.a, state.b),
    hasResult: () => state.result !== undefined && state.result !== 0,
    checkResult: () => (state.hasResult() ? state.result : state.getResult()),
    reset: () => {
      state.a = state.initialA;
      state.b = state.initialB;
      state.result = undefined;
      state.isFinished = false;
      state.comparator = actions['default'].func;
    }
  };
  state.reset();
  pipeline.state = state;

  pipeline.forEach(step => {
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
function createTargetProxy(type, proxyOptions = {}) {
  return new Proxy({}, {
    get: (obj, prop) => {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'type') return type;
      if (prop === 'configurable') return createTargetProxy(type, { configurable: true });
      return (actions[prop] || {}).func;
    },
    set: (obj, prop, func) => {
      if (prop === 'configurable') throw new Error('Attempting to set a read-only property: ' + prop);
      if (typeof func !== 'function') throw new Error('Attempted to set Comparator function to non-function: ' + func);
      let options = Object.assign({}, proxyOptions);

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
    deleteProperty: (obj, prop) => {
      delete actions[prop];
      return true;
    },
  });
}
function createComparatorProxy(previousPipeline = [], step) {
  let pipeline = step ? previousPipeline.concat(step) : [].concat(previousPipeline);
  let proxiedFunction = (a, b) => pipelineRunner(pipeline, a, b);
  proxiedFunction.pipeline = pipeline;

  const getProp = prop => {
    let funcs = functionsPerType[prop];
    if (funcs) return funcs;

    switch(prop) {
      case Symbol.toStringTag: return step ? String(step.func) : undefined;
      case Symbol.toPrimitive: return (...args) => 'Comparator: ' + pipelineToString(pipeline);
      case Symbol['util.inspect.custom']: return 'Comparator function';
      case 'valueOf': return proxiedFunction;
      case 'name': return 'ComparatorProxy';
      case 'setup': return (...args) => createComparatorProxy(pipeline.concat(createPipelineFromArgs(...args)));
      default:
    }
    if (proxiedFunction[prop]) return proxiedFunction[prop];

    let newStep = actions[prop];
    if (!newStep && prop === 'configurable') return functionsPerType[COMPARATOR][prop];
    if (!newStep) {
      if (prop === '__esModule') return undefined;
      throw new Error('Unknown Comparator function requested: ' + String(prop));
    }
    if (newStep.configurable) {
      const createStep = (...args) => ({
        name: newStep.name,
        type: newStep.type,
        func: newStep.func.apply(null, args)
      });
      const cfgFunc = (...args) => {
        return createComparatorProxy(pipeline, createStep(...args));
      };
      return new Proxy(cfgFunc, {
        get: (obj, prop) => createComparatorProxy(pipeline, createStep())[prop],
        set: (obj, prop, value) => setProp(prop, value),
        deleteProperty: (obj, prop) => delProp(prop)
      });
    }
    return createComparatorProxy(pipeline, newStep);
  };
  const setProp = (prop, value) => {
    if (prop in functionsPerType) throw new Error('Field is readonly: ' + prop);
    functionsPerType.comparators[prop] = value;
    return true;
  };
  const delProp = (prop) => {
    delete actions[prop];
    return true;
  };

  return new Proxy( proxiedFunction, {
    get: (obj, prop) => getProp(prop),
    set: (obj, prop, value) => setProp(prop, value),
    deleteProperty: (obj, prop) => delProp(prop)
  });
}

function createPipelineFromArgs(...items) {
  let pipeline = [];
  items = flatten(items);
  while (items.length) {
    let prop = items.shift();
    let action = actions[prop];
    if (!action) throw new Error('Unknown step requested: ' + prop);
    if (action.configurable) {
      const arg = items.shift(); // currently all configurables have exactly 1 argument in setup.
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
  return pipeline.map(s=>s.name + (s.args ? '(' + s.args + ')' : '')).join('.') || '[empty]';
}
function flatten(array, flattening) {
  if (!(flattening instanceof Set)) flattening = new Set();
  if (flattening.has(array)) return []; // prevent endless recursion
  flattening.add(array);
  let flat = [];
  array.forEach( item => {
    if (Array.isArray(item)) {
      flatten(item, flattening).forEach( fitem => flat.push(fitem) );
    } else {
      flat.push(item);
    }
  });
  return flat;
}
})(require('natural-sort'));
