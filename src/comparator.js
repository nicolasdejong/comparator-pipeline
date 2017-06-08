'use strict'
let naturalSort = require('natural-sort')();

/**
 * Comparators.
 * Pipeline comparator. Pipeline is performed left to right.
 * For example array.sort(Comparator.natural.reversed);
 *
 * See readme.md for documentation.
 **/
const Comparator = createComparatorProxy([]);
module.exports = Comparator;

const actions = {}; // name -> { func, name, type }
const COMPARATOR   = 'comparators';
const KEYMAPPER    = 'keyMappers';
const VALUEMAPPER  = 'valueMappers';
const RESULTMAPPER = 'resultMappers';
const functionsPerType = {
  [COMPARATOR]:   createTargetProxy(COMPARATOR),
  [KEYMAPPER]:    createTargetProxy(KEYMAPPER),
  [VALUEMAPPER]:  createTargetProxy(VALUEMAPPER),
  [RESULTMAPPER]: createTargetProxy(RESULTMAPPER)
};
const defaultSort = (a, b) => (a < b ? -1 : (a === b ? 0 : 1));

Comparator['default'] = defaultSort;
Comparator.natural    = naturalSort;
Comparator.literal    = defaultSort;
Comparator.configurable.locale = (locales, ...options) => (a, b) => String(a).localeCompare(b, locales, ...options);
Comparator.configurable.setup = function(...items) {
  // this = { pipeline, actions, createComparatorProxy }
  let pipeline = this.pipeline;
  items = flatten(items);
  while (items.length) {
    let prop = items.shift();
    let action = this.actions[prop];
    if (!action) throw new Error('Unknown action requested: ' + prop);
    if (action.configurable) action = {
      type: action.type,
      name: action.name,
      func: action.func.call(undefined, items.shift())
    };
    pipeline.push(action);
  }
  return createComparatorProxy(pipeline);
};

Comparator.valueMappers.any        = v => v;
Comparator.valueMappers.text       = v => String(v);
Comparator.valueMappers.string     = Comparator.valueMappers.text;
Comparator.valueMappers.strings    = Comparator.valueMappers.string;
Comparator.valueMappers.numbers    = v => parseFloat(v);
Comparator.valueMappers.number     = Comparator.valueMappers.numbers;
Comparator.valueMappers.configurable.map = mapper => (val, obj) => mapper(val, obj);
Comparator.valueMappers.ignoreCase = v => String(v).toLowerCase();
Comparator.valueMappers.trim       = v => String(v).trim();

Comparator.keyMappers.configurable.key = (...names) => resultIn => {
  let result = resultIn;
  names.forEach( name => result = result ? result[name] : result );
  return result;
};

Comparator.resultMappers.reversed = function(result) { this.reversed = !this.reversed; return -result; };
Comparator.resultMappers.reverse  = Comparator.resultMappers.reversed;
Comparator.resultMappers.ascending = function(result) { if (this.reversed) { this.reversed = false; return -result; } return result; };
Comparator.resultMappers.ascend    = Comparator.resultMappers.ascending;
Comparator.resultMappers.descending = function(result) { if (!this.reversed) { this.reversed = true; return -result; } return result; };
Comparator.resultMappers.descend    = Comparator.resultMappers.descending;

function pipelineRunner(pipeline, a, b) {
  let state = {
    initialA: a,
    initialB: b,
    result: undefined,
    finished: false,
    mappedKey: false,
    pipeline: pipeline
  };
  let getResult = () => state.result = actions['default'].func.call(state, a, b);
  let hasResult = () => state.result !== undefined && state.result !== 0;

  pipeline.forEach(step => {
    if (state.finished) return;

    if (!hasResult()) {
      switch (step.type) {
        case COMPARATOR:   state.result = step.func(a, b);
                           break;
        case VALUEMAPPER:  a = step.func.call(state, a, state.initialA);
                           b = step.func.call(state, b, state.initialB);
                           break;
        case RESULTMAPPER: getResult();
                           if (hasResult()) {
                             state.result = step.func.call(state, state.result);
                           }
                           break;
        case KEYMAPPER:    if (state.mappedKey && hasResult(getResult())) {
                             state.finished = true;
                           } else {
                             a = step.func.call(state, state.initialA);
                             b = step.func.call(state, state.initialB);
                             state.mappedKey = true;
                           }
                           break;
      }
    } else {
      switch (step.type) {
        case KEYMAPPER:    state.finished = true;
                           break;
        case RESULTMAPPER: state.result = step.func.call(state, state.result);
                           break;
      }
    }
  });
  if (state.result === undefined) getResult();
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
    }
  });
}
function createComparatorProxy(previousPipeline = [], step) {
  let pipeline = step ? previousPipeline.concat(step) : [].concat(previousPipeline);
  return new Proxy( (a, b) => pipelineRunner(pipeline, a, b), {
    get: (obj, prop) => {
      let funcs = functionsPerType[prop];
      if (funcs) return funcs;

      if (prop === Symbol.toStringTag) return step ? String(step.func) : undefined;
      if (prop === Symbol.toPrimitive) return obj;

      let newStep = actions[prop];
      if (!newStep && prop === 'configurable') return functionsPerType[COMPARATOR][prop];
      if (!newStep) throw new Error('Unknown Comparator function requested: ' + String(prop));
      if (newStep.configurable) return (...args) => {
       return createComparatorProxy(pipeline, {
         func: newStep.func.apply({
           pipeline: pipeline.slice(),
           actions: actions,
           createComparatorProxy: createComparatorProxy
         }, args),
         type: newStep.type
       });
      };
      return createComparatorProxy(pipeline, newStep);
    },
    set: (obj, prop, value) => {
      functionsPerType.comparators[prop] = value;
      return true;
    }
  });
}

// Returns a new array where all elements that are arrays are replaced by their elements, recursively
// This was originally written on Array.prototype but there should not be side-effects in this module.
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
};
